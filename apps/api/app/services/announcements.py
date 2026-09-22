import uuid
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.errors import AppError, ErrorCode
from app.models.announcements import Announcement, AnnouncementRead
from app.models.education import Guardian, Section, Student, StudentEnrolment, StudentGuardian
from app.services.notification_rules import fire_trigger
from app.storage import save_file


def _announcement_audience_emails(
    db: Session, *, tenant_id: uuid.UUID, target_type: str, target_branch_id: uuid.UUID | None,
    target_school_class_id: uuid.UUID | None, target_section_id: uuid.UUID | None,
) -> list[str]:
    """The inverse of list_visible_announcements_for_guardian's own
    per-guardian scope check -- given a fresh announcement's targeting,
    find every guardian actually in scope, for the real email trigger
    (ADR-043). Same live-resolved-off-StudentEnrolment discipline, not
    a cached audience list."""
    student_ids_stmt = select(Student.id).where(Student.tenant_id == tenant_id)
    if target_type == "campus":
        student_ids_stmt = student_ids_stmt.where(Student.branch_id == target_branch_id)
    elif target_type in ("class", "section"):
        enrolment_stmt = select(StudentEnrolment.student_id).where(StudentEnrolment.tenant_id == tenant_id, StudentEnrolment.school_class_id == target_school_class_id)
        if target_type == "section":
            enrolment_stmt = enrolment_stmt.where(StudentEnrolment.section_id == target_section_id)
        student_ids_stmt = student_ids_stmt.where(Student.id.in_(select(enrolment_stmt.subquery().c.student_id)))
    student_ids = [row[0] for row in db.execute(student_ids_stmt).all()]
    if not student_ids:
        return []

    emails = db.execute(
        select(Guardian.email).join(StudentGuardian, StudentGuardian.guardian_id == Guardian.id)
        .where(StudentGuardian.tenant_id == tenant_id, StudentGuardian.student_id.in_(student_ids), Guardian.email.is_not(None))
        .distinct()
    ).scalars().all()
    return [e for e in emails if e]


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

    emails = _announcement_audience_emails(
        db, tenant_id=tenant_id, target_type=target_type, target_branch_id=target_branch_id,
        target_school_class_id=target_school_class_id, target_section_id=target_section_id,
    )
    for email in emails:
        fire_trigger(
            db, tenant_id=tenant_id, trigger_type="announcement_published", title=title, message=body,
            entity_type="announcement", entity_id=announcement.id, recipient_email=email,
        )
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


def upload_announcement_attachment(db: Session, *, tenant_id: uuid.UUID, announcement_id: uuid.UUID, file_name: str, content: bytes) -> Announcement:
    announcement = db.get(Announcement, announcement_id)
    if announcement is None or announcement.tenant_id != tenant_id:
        raise AppError(ErrorCode.NOT_FOUND, "Announcement not found.", status_code=404)
    announcement.attachment_path = save_file(tenant_id=tenant_id, category="announcement_attachments", file_name=file_name, content=content)
    announcement.attachment_file_name = file_name
    db.flush()
    return announcement


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
        {
            "id": a.id, "title": a.title, "body": a.body, "target_type": a.target_type, "created_at": a.created_at,
            "is_read": a.id in read_ids, "attachment_file_name": a.attachment_file_name,
        }
        for a in visible
    ]


def get_guardian_visible_announcement(db: Session, *, tenant_id: uuid.UUID, guardian_id: uuid.UUID, announcement_id: uuid.UUID) -> Announcement:
    """Re-derives visibility the same way list_visible_announcements_for_guardian
    does -- a guardian can only fetch an attachment for an announcement
    actually in their own scope, not any announcement_id in the tenant."""
    visible_ids = {a["id"] for a in list_visible_announcements_for_guardian(db, tenant_id=tenant_id, guardian_id=guardian_id)}
    if announcement_id not in visible_ids:
        raise AppError(ErrorCode.NOT_FOUND, "Announcement not found.", status_code=404)
    announcement = db.get(Announcement, announcement_id)
    if announcement is None or announcement.attachment_path is None:
        raise AppError(ErrorCode.NOT_FOUND, "No attachment for this announcement.", status_code=404)
    return announcement


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
