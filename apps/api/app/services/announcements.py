import uuid
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.errors import AppError, ErrorCode
from app.models.announcements import Announcement, AnnouncementRead
from app.models.education import Section, Student, StudentEnrolment, StudentGuardian


def create_announcement(
    db: Session, *, tenant_id: uuid.UUID, company_id: uuid.UUID, published_by_user_id: uuid.UUID, title: str, body: str,
    target_type: str, target_branch_id: uuid.UUID | None, target_school_class_id: uuid.UUID | None, target_section_id: uuid.UUID | None,
    expires_at: date | None,
) -> Announcement:
    if target_type == "school":
        if target_branch_id or target_school_class_id or target_section_id:
            raise AppError(ErrorCode.VALIDATION_ERROR, "A school-wide announcement cannot target a campus, class, or section.")
    elif target_type == "campus":
        if not target_branch_id or target_school_class_id or target_section_id:
            raise AppError(ErrorCode.VALIDATION_ERROR, "A campus announcement needs a campus and no class or section.")
    elif target_type == "class":
        if not target_school_class_id or target_section_id:
            raise AppError(ErrorCode.VALIDATION_ERROR, "A class announcement needs a class and no section.")
    elif target_type == "section":
        if not target_school_class_id or not target_section_id:
            raise AppError(ErrorCode.VALIDATION_ERROR, "A section announcement needs both a class and a section.")
        section = db.get(Section, target_section_id)
        if section is None or section.tenant_id != tenant_id or section.school_class_id != target_school_class_id:
            raise AppError(ErrorCode.VALIDATION_ERROR, "That section does not belong to the given class.")
    else:
        raise AppError(ErrorCode.VALIDATION_ERROR, f"Unknown target_type '{target_type}'.")

    announcement = Announcement(
        tenant_id=tenant_id, company_id=company_id, title=title, body=body, target_type=target_type,
        target_branch_id=target_branch_id, target_school_class_id=target_school_class_id, target_section_id=target_section_id,
        published_by_user_id=published_by_user_id, expires_at=expires_at,
    )
    db.add(announcement)
    db.flush()
    return announcement


def list_announcements(db: Session, *, tenant_id: uuid.UUID) -> list[Announcement]:
    return db.execute(
        select(Announcement).where(Announcement.tenant_id == tenant_id).order_by(Announcement.created_at.desc())
    ).scalars().all()


def delete_announcement(db: Session, *, tenant_id: uuid.UUID, announcement_id: uuid.UUID) -> None:
    announcement = db.get(Announcement, announcement_id)
    if announcement is None or announcement.tenant_id != tenant_id:
        raise AppError(ErrorCode.NOT_FOUND, "Announcement not found.", status_code=404)
    db.delete(announcement)
    db.flush()


def _guardian_scope(db: Session, *, tenant_id: uuid.UUID, guardian_id: uuid.UUID) -> tuple[set[uuid.UUID], set[uuid.UUID], set[uuid.UUID]]:
    """A guardian's real audience scope: every campus, class, and
    section any linked child is (or has ever been) placed in --
    a guardian with children at two campuses legitimately sees
    campus-targeted announcements for both (ADR-038)."""
    student_ids = [
        row[0] for row in db.execute(
            select(StudentGuardian.student_id).where(StudentGuardian.tenant_id == tenant_id, StudentGuardian.guardian_id == guardian_id)
        ).all()
    ]
    if not student_ids:
        return set(), set(), set()

    branch_ids = {
        row[0] for row in db.execute(
            select(Student.branch_id).where(Student.tenant_id == tenant_id, Student.id.in_(student_ids))
        ).all()
    }
    enrolments = db.execute(
        select(StudentEnrolment.school_class_id, StudentEnrolment.section_id).where(
            StudentEnrolment.tenant_id == tenant_id, StudentEnrolment.student_id.in_(student_ids)
        )
    ).all()
    class_ids = {row[0] for row in enrolments}
    section_ids = {row[1] for row in enrolments if row[1] is not None}
    return branch_ids, class_ids, section_ids


def list_visible_announcements_for_guardian(db: Session, *, tenant_id: uuid.UUID, guardian_id: uuid.UUID) -> list[dict]:
    """Targeting is resolved live off each linked child's current
    enrolment -- never a cached audience list -- so a guardian sees
    exactly the announcements relevant to where their children are
    enrolled right now, including across every academic year they've
    ever been enrolled in (a class-targeted announcement from last
    year should not vanish just because the child was promoted)."""
    branch_ids, class_ids, section_ids = _guardian_scope(db, tenant_id=tenant_id, guardian_id=guardian_id)
    today = date.today()

    all_announcements = db.execute(
        select(Announcement).where(Announcement.tenant_id == tenant_id).order_by(Announcement.created_at.desc())
    ).scalars().all()

    visible = [
        a for a in all_announcements
        if (a.expires_at is None or a.expires_at >= today)
        and (
            a.target_type == "school"
            or (a.target_type == "campus" and a.target_branch_id in branch_ids)
            or (a.target_type == "class" and a.target_school_class_id in class_ids)
            or (a.target_type == "section" and a.target_section_id in section_ids)
        )
    ]

    read_ids = {
        row[0] for row in db.execute(
            select(AnnouncementRead.announcement_id).where(AnnouncementRead.tenant_id == tenant_id, AnnouncementRead.guardian_id == guardian_id)
        ).all()
    }

    return [
        {"id": a.id, "title": a.title, "body": a.body, "target_type": a.target_type, "created_at": a.created_at, "is_read": a.id in read_ids}
        for a in visible
    ]


def mark_announcement_read(db: Session, *, tenant_id: uuid.UUID, guardian_id: uuid.UUID, announcement_id: uuid.UUID) -> None:
    announcement = db.get(Announcement, announcement_id)
    if announcement is None or announcement.tenant_id != tenant_id:
        raise AppError(ErrorCode.NOT_FOUND, "Announcement not found.", status_code=404)

    existing = db.execute(
        select(AnnouncementRead).where(
            AnnouncementRead.tenant_id == tenant_id, AnnouncementRead.announcement_id == announcement_id, AnnouncementRead.guardian_id == guardian_id
        )
    ).scalar_one_or_none()
    if existing is not None:
        return
    db.add(AnnouncementRead(tenant_id=tenant_id, announcement_id=announcement_id, guardian_id=guardian_id))
    db.flush()
