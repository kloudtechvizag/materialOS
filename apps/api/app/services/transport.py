import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.errors import AppError, ErrorCode
from app.models.education import AcademicYear, Student
from app.models.fleet import Driver, Vehicle
from app.models.transport import RouteStop, StudentTransportAssignment, TransportRoute


def create_route(db: Session, *, tenant_id: uuid.UUID, company_id: uuid.UUID, name: str, vehicle_id: uuid.UUID, driver_id: uuid.UUID) -> TransportRoute:
    vehicle = db.get(Vehicle, vehicle_id)
    if vehicle is None or vehicle.tenant_id != tenant_id:
        raise AppError(ErrorCode.VALIDATION_ERROR, "Vehicle not found.")
    driver = db.get(Driver, driver_id)
    if driver is None or driver.tenant_id != tenant_id:
        raise AppError(ErrorCode.VALIDATION_ERROR, "Driver not found.")

    route = TransportRoute(tenant_id=tenant_id, company_id=company_id, name=name, vehicle_id=vehicle_id, driver_id=driver_id)
    db.add(route)
    db.flush()
    return route


def list_routes(db: Session, *, tenant_id: uuid.UUID) -> list[TransportRoute]:
    return db.execute(
        select(TransportRoute).where(TransportRoute.tenant_id == tenant_id, TransportRoute.is_active.is_(True)).order_by(TransportRoute.name)
    ).scalars().all()


def _route(db: Session, tenant_id: uuid.UUID, route_id: uuid.UUID) -> TransportRoute:
    route = db.get(TransportRoute, route_id)
    if route is None or route.tenant_id != tenant_id:
        raise AppError(ErrorCode.NOT_FOUND, "Route not found.", status_code=404)
    return route


def create_stop(db: Session, *, tenant_id: uuid.UUID, route_id: uuid.UUID, name: str, sequence: int, pickup_time, drop_time) -> RouteStop:
    _route(db, tenant_id, route_id)
    stop = RouteStop(tenant_id=tenant_id, route_id=route_id, name=name, sequence=sequence, pickup_time=pickup_time, drop_time=drop_time)
    db.add(stop)
    db.flush()
    return stop


def list_stops(db: Session, *, tenant_id: uuid.UUID, route_id: uuid.UUID) -> list[RouteStop]:
    _route(db, tenant_id, route_id)
    return db.execute(
        select(RouteStop).where(RouteStop.tenant_id == tenant_id, RouteStop.route_id == route_id).order_by(RouteStop.sequence)
    ).scalars().all()


def assign_student_to_route(
    db: Session, *, tenant_id: uuid.UUID, student_id: uuid.UUID, academic_year_id: uuid.UUID, route_id: uuid.UUID, stop_id: uuid.UUID
) -> StudentTransportAssignment:
    student = db.get(Student, student_id)
    if student is None or student.tenant_id != tenant_id:
        raise AppError(ErrorCode.VALIDATION_ERROR, "Student not found.")
    _route(db, tenant_id, route_id)
    stop = db.get(RouteStop, stop_id)
    if stop is None or stop.tenant_id != tenant_id or stop.route_id != route_id:
        raise AppError(ErrorCode.VALIDATION_ERROR, "That stop does not belong to the given route.")

    existing = db.execute(
        select(StudentTransportAssignment).where(
            StudentTransportAssignment.tenant_id == tenant_id, StudentTransportAssignment.student_id == student_id,
            StudentTransportAssignment.academic_year_id == academic_year_id,
        )
    ).scalar_one_or_none()

    if existing is not None:
        existing.route_id = route_id
        existing.stop_id = stop_id
        db.flush()
        return existing

    assignment = StudentTransportAssignment(
        tenant_id=tenant_id, student_id=student_id, academic_year_id=academic_year_id, route_id=route_id, stop_id=stop_id,
    )
    db.add(assignment)
    db.flush()
    return assignment


def get_route_roster(db: Session, *, tenant_id: uuid.UUID, route_id: uuid.UUID) -> list[dict]:
    _route(db, tenant_id, route_id)
    rows = db.execute(
        select(StudentTransportAssignment, Student, RouteStop)
        .join(Student, Student.id == StudentTransportAssignment.student_id)
        .join(RouteStop, RouteStop.id == StudentTransportAssignment.stop_id)
        .where(StudentTransportAssignment.tenant_id == tenant_id, StudentTransportAssignment.route_id == route_id)
        .order_by(RouteStop.sequence, Student.first_name)
    ).all()

    return [
        {"student_id": student.id, "first_name": student.first_name, "last_name": student.last_name, "stop_id": stop.id, "stop_name": stop.name}
        for _assignment, student, stop in rows
    ]


def get_student_transport(db: Session, *, tenant_id: uuid.UUID, student_id: uuid.UUID) -> dict | None:
    row = db.execute(
        select(StudentTransportAssignment)
        .join(AcademicYear, AcademicYear.id == StudentTransportAssignment.academic_year_id)
        .where(StudentTransportAssignment.tenant_id == tenant_id, StudentTransportAssignment.student_id == student_id, AcademicYear.is_current.is_(True))
    ).scalar_one_or_none()
    if row is None:
        return None

    route = db.get(TransportRoute, row.route_id)
    stop = db.get(RouteStop, row.stop_id)
    vehicle = db.get(Vehicle, route.vehicle_id)
    driver = db.get(Driver, route.driver_id)

    return {
        "route_id": route.id, "route_name": route.name, "vehicle_registration_number": vehicle.registration_number,
        "driver_name": driver.name, "driver_phone": driver.phone, "stop_name": stop.name,
        "pickup_time": stop.pickup_time, "drop_time": stop.drop_time,
    }
