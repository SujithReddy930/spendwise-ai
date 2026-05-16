from sqlalchemy import Column
from sqlalchemy import Integer
from sqlalchemy import String

from app.database import Base

class Receipt(Base):
    __tablename__ = "receipts"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    image_url = Column(String)

    raw_text = Column(String)

    title = Column(String)

    amount = Column(String)

    category = Column(String)   