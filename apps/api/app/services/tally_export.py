"""A3: "Tally keeps your books. MaterialOS runs your business." This is
the export half of Slice 0's importer -- one JournalEntry (with its
JournalLines) becomes one Tally VOUCHER, symmetric to how Slice 0 turned
Tally LEDGER/STOCKITEM masters into rows here.

Sign convention: Tally XML represents a debit as a negative AMOUNT with
ISDEEMEDPOSITIVE=Yes and a credit as a positive AMOUNT with
ISDEEMEDPOSITIVE=No, which is the documented convention for voucher
import -- but this has not been validated against a live Tally import
(no Tally instance is available in this environment). A CA should
import one period into a test company before relying on this for bulk
data entry.
"""

from datetime import date
from decimal import Decimal
from xml.etree.ElementTree import Element, SubElement, tostring
from xml.dom import minidom

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.accounting import Account, JournalEntry, JournalLine

VOUCHER_TYPE_BY_DOCUMENT = {
    "invoice": "Sales",
    "receipt": "Receipt",
    "purchase_bill": "Purchase",
    "supplier_payment": "Payment",
    "sales_return": "Credit Note",
}


def export_period_to_tally_xml(db: Session, *, company_id, from_date: date, to_date: date) -> str:
    entries = db.execute(
        select(JournalEntry)
        .where(JournalEntry.company_id == company_id, JournalEntry.entry_date >= from_date, JournalEntry.entry_date <= to_date)
        .order_by(JournalEntry.entry_date, JournalEntry.created_at)
    ).scalars().all()

    envelope = Element("ENVELOPE")
    header = SubElement(envelope, "HEADER")
    SubElement(header, "TALLYREQUEST").text = "Import Data"
    body = SubElement(envelope, "BODY")
    import_data = SubElement(body, "IMPORTDATA")
    request_desc = SubElement(import_data, "REQUESTDESC")
    SubElement(request_desc, "REPORTNAME").text = "Vouchers"
    request_data = SubElement(import_data, "REQUESTDATA")

    for entry in entries:
        lines = db.execute(select(JournalLine).where(JournalLine.journal_entry_id == entry.id)).scalars().all()
        message = SubElement(request_data, "TALLYMESSAGE")
        voucher = SubElement(message, "VOUCHER", VCHTYPE=VOUCHER_TYPE_BY_DOCUMENT.get(entry.document_type, "Journal"), ACTION="Create")
        SubElement(voucher, "DATE").text = entry.entry_date.strftime("%Y%m%d")
        SubElement(voucher, "VOUCHERTYPENAME").text = VOUCHER_TYPE_BY_DOCUMENT.get(entry.document_type, "Journal")
        SubElement(voucher, "NARRATION").text = entry.narration or ""

        for line in lines:
            account = db.get(Account, line.account_id)
            ledger_entry = SubElement(voucher, "ALLLEDGERENTRIES.LIST")
            SubElement(ledger_entry, "LEDGERNAME").text = account.name
            is_debit = line.debit > 0
            SubElement(ledger_entry, "ISDEEMEDPOSITIVE").text = "Yes" if is_debit else "No"
            amount = -line.debit if is_debit else line.credit
            SubElement(ledger_entry, "AMOUNT").text = f"{amount:.2f}"

    rough = tostring(envelope, encoding="unicode")
    return minidom.parseString(rough).toprettyxml(indent="  ")
