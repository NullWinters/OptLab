from typing import Any

from sqlalchemy import select
from sqlalchemy import delete

from models import AsyncSession
from models.experiment_record import ExperimentRecord




class ExperimentRecordRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(
        self,
        *,
        user_id: int,
        alias: str,
        source_page: str,
        payload: dict[str, Any],
    ) -> ExperimentRecord:
        async with self.session.begin():
            record = ExperimentRecord(
                user_id=user_id,
                alias=alias,
                source_page=source_page,
                payload=payload,
            )
            self.session.add(record)
            await self.session.flush()
            await self.session.refresh(record)
            return record

    async def list_by_user(self, user_id: int) -> list[ExperimentRecord]:
        async with self.session.begin():
            stmt = (
                select(ExperimentRecord)
                .where(ExperimentRecord.user_id == user_id)
                .order_by(ExperimentRecord.created_at.desc())
            )
            result = await self.session.scalars(stmt)
            return list(result.all())

    async def get_by_id_and_user(
        self, record_id: int, user_id: int
    ) -> ExperimentRecord | None:
        async with self.session.begin():
            stmt = select(ExperimentRecord).where(
                ExperimentRecord.id == record_id,
                ExperimentRecord.user_id == user_id,
            )
            return await self.session.scalar(stmt)

    async def update_alias(
        self, *, record_id: int, user_id: int, alias: str
    ) -> ExperimentRecord | None:
        async with self.session.begin():
            stmt = select(ExperimentRecord).where(
                ExperimentRecord.id == record_id,
                ExperimentRecord.user_id == user_id,
            )
            record = await self.session.scalar(stmt)
            if record is None:
                return None
            record.alias = alias
            await self.session.flush()
            await self.session.refresh(record)
            return record

    async def delete_by_id_and_user(self, *, record_id: int, user_id: int) -> bool:
        async with self.session.begin():
            stmt = delete(ExperimentRecord).where(
                ExperimentRecord.id == record_id,
                ExperimentRecord.user_id == user_id,
            )
            result = await self.session.execute(stmt)
            return bool(getattr(result, "rowcount", 0))

