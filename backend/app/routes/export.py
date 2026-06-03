# backend/app/routes/export.py
import csv
import io
from datetime import datetime
from calendar import monthrange
from typing import Optional

from fastapi import APIRouter, Depends, Header, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT

from app.database import get_db
from app.models.expense import Expense
from app.core.security import decode_token

router = APIRouter(prefix="/export", tags=["Export"])


# ── Auth helper ────────────────────────────────────────────────────────────────

def get_current_user_id(authorization: Optional[str] = Header(None)) -> Optional[int]:
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization.split(" ")[1]
    payload = decode_token(token)
    if not payload:
        return None
    try:
        return int(payload.get("sub"))
    except Exception:
        return None


# ── Fetch expenses helper ──────────────────────────────────────────────────────

def fetch_expenses(db: Session, user_id: int, month: Optional[int], year: Optional[int]):
    query = db.query(Expense).filter(Expense.user_id == user_id)
    expenses = query.order_by(Expense.date.desc()).all()

    if month and year:
        expenses = [
            e for e in expenses
            if isinstance(e.date, datetime) and e.date.month == month and e.date.year == year
        ]
    return expenses


# ── Export CSV ─────────────────────────────────────────────────────────────────

@router.get("/csv")
def export_csv(
    month: Optional[int] = Query(None),
    year: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(None),
):
    user_id = get_current_user_id(authorization)
    expenses = fetch_expenses(db, user_id, month, year)

    output = io.StringIO()
    writer = csv.writer(output)

    # Header row
    writer.writerow(["#", "Title", "Amount (₹)", "Category", "Payment Method", "Date", "Note", "Recurring"])

    # Data rows
    for i, e in enumerate(expenses, 1):
        writer.writerow([
            i,
            e.title,
            f"{e.amount:.2f}",
            e.category,
            e.payment_method or "UPI",
            e.date.strftime("%Y-%m-%d") if isinstance(e.date, datetime) else "",
            e.note or "",
            "Yes" if e.is_recurring else "No",
        ])

    # Summary row
    total = sum(e.amount for e in expenses)
    writer.writerow([])
    writer.writerow(["", "TOTAL", f"{total:.2f}", "", "", "", "", ""])

    output.seek(0)

    label = f"{year}-{month:02d}" if month and year else "all"
    filename = f"spendwise_expenses_{label}.csv"

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


# ── Export PDF ─────────────────────────────────────────────────────────────────

@router.get("/pdf")
def export_pdf(
    month: Optional[int] = Query(None),
    year: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(None),
):
    user_id = get_current_user_id(authorization)
    expenses = fetch_expenses(db, user_id, month, year)

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=15 * mm,
        leftMargin=15 * mm,
        topMargin=20 * mm,
        bottomMargin=20 * mm,
    )

    styles = getSampleStyleSheet()
    elements = []

    # ── Title ──────────────────────────────────────────────────────────────
    title_style = ParagraphStyle(
        "Title",
        parent=styles["Title"],
        fontSize=22,
        textColor=colors.HexColor("#10b981"),
        spaceAfter=4,
        alignment=TA_CENTER,
    )
    subtitle_style = ParagraphStyle(
        "Subtitle",
        parent=styles["Normal"],
        fontSize=11,
        textColor=colors.HexColor("#6b7280"),
        spaceAfter=16,
        alignment=TA_CENTER,
    )

    elements.append(Paragraph("SpendWise AI", title_style))

    if month and year:
        month_name = datetime(year, month, 1).strftime("%B %Y")
        elements.append(Paragraph(f"Expense Report — {month_name}", subtitle_style))
    else:
        elements.append(Paragraph("Full Expense Report", subtitle_style))

    elements.append(Paragraph(
        f"Generated: {datetime.utcnow().strftime('%d %b %Y, %H:%M UTC')}  |  Total records: {len(expenses)}",
        ParagraphStyle("Meta", parent=styles["Normal"], fontSize=9,
                       textColor=colors.HexColor("#9ca3af"), alignment=TA_CENTER, spaceAfter=20),
    ))

    # ── Summary cards ──────────────────────────────────────────────────────
    total = sum(e.amount for e in expenses)
    by_cat = {}
    for e in expenses:
        by_cat[e.category] = by_cat.get(e.category, 0) + e.amount

    top_cat = max(by_cat, key=by_cat.get) if by_cat else "N/A"
    top_cat_amt = by_cat.get(top_cat, 0)

    summary_data = [
        ["Total Spent", "Transactions", "Top Category"],
        [f"₹{total:,.2f}", str(len(expenses)), f"{top_cat}\n₹{top_cat_amt:,.2f}"],
    ]
    summary_table = Table(summary_data, colWidths=[55 * mm, 55 * mm, 55 * mm])
    summary_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#10b981")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 11),
        ("BACKGROUND", (0, 1), (-1, 1), colors.HexColor("#f0fdf4")),
        ("FONTNAME", (0, 1), (-1, 1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 1), (-1, 1), 13),
        ("TEXTCOLOR", (0, 1), (-1, 1), colors.HexColor("#111827")),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ROWBACKGROUNDS", (0, 1), (-1, 1), [colors.HexColor("#f0fdf4")]),
        ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#d1fae5")),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#d1fae5")),
        ("TOPPADDING", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ("ROUNDEDCORNERS", [4, 4, 4, 4]),
    ]))
    elements.append(summary_table)
    elements.append(Spacer(1, 16))

    # ── Expense table ──────────────────────────────────────────────────────
    if expenses:
        header = ["#", "Title", "Amount (₹)", "Category", "Payment", "Date"]
        rows = [header]
        for i, e in enumerate(expenses, 1):
            rows.append([
                str(i),
                e.title[:35] + "…" if len(e.title) > 35 else e.title,
                f"₹{e.amount:,.2f}",
                e.category,
                e.payment_method or "UPI",
                e.date.strftime("%d %b %Y") if isinstance(e.date, datetime) else "",
            ])

        # Total row
        rows.append(["", "TOTAL", f"₹{total:,.2f}", "", "", ""])

        col_widths = [10 * mm, 60 * mm, 30 * mm, 30 * mm, 25 * mm, 25 * mm]
        expense_table = Table(rows, colWidths=col_widths, repeatRows=1)
        expense_table.setStyle(TableStyle([
            # Header
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#111827")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, 0), 9),
            ("ALIGN", (0, 0), (-1, 0), "CENTER"),
            # Body
            ("FONTNAME", (0, 1), (-1, -2), "Helvetica"),
            ("FONTSIZE", (0, 1), (-1, -2), 8),
            ("ROWBACKGROUNDS", (0, 1), (-1, -2), [colors.white, colors.HexColor("#f9fafb")]),
            ("TEXTCOLOR", (0, 1), (-1, -2), colors.HexColor("#374151")),
            # Amount column green
            ("TEXTCOLOR", (2, 1), (2, -2), colors.HexColor("#059669")),
            ("FONTNAME", (2, 1), (2, -2), "Helvetica-Bold"),
            # Total row
            ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#f0fdf4")),
            ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
            ("FONTSIZE", (0, -1), (-1, -1), 9),
            ("TEXTCOLOR", (2, -1), (2, -1), colors.HexColor("#10b981")),
            # Grid
            ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#e5e7eb")),
            ("INNERGRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#e5e7eb")),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ]))
        elements.append(expense_table)
    else:
        elements.append(Paragraph(
            "No expenses found for the selected period.",
            ParagraphStyle("Empty", parent=styles["Normal"], fontSize=11,
                           textColor=colors.HexColor("#9ca3af"), alignment=TA_CENTER),
        ))

    # ── Category breakdown ─────────────────────────────────────────────────
    if by_cat:
        elements.append(Spacer(1, 20))
        elements.append(Paragraph(
            "Category Breakdown",
            ParagraphStyle("SectionTitle", parent=styles["Normal"], fontSize=13,
                           fontName="Helvetica-Bold", textColor=colors.HexColor("#111827"),
                           spaceAfter=8),
        ))
        cat_data = [["Category", "Amount (₹)", "% of Total"]]
        for cat, amt in sorted(by_cat.items(), key=lambda x: x[1], reverse=True):
            pct = (amt / total * 100) if total > 0 else 0
            cat_data.append([cat, f"₹{amt:,.2f}", f"{pct:.1f}%"])

        cat_table = Table(cat_data, colWidths=[70 * mm, 60 * mm, 40 * mm])
        cat_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#111827")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, 0), 9),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f9fafb")]),
            ("FONTSIZE", (0, 1), (-1, -1), 8),
            ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#e5e7eb")),
            ("INNERGRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#e5e7eb")),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("ALIGN", (1, 0), (-1, -1), "CENTER"),
        ]))
        elements.append(cat_table)

    doc.build(elements)
    buffer.seek(0)

    label = f"{year}-{month:02d}" if month and year else "all"
    filename = f"spendwise_expenses_{label}.pdf"

    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
    