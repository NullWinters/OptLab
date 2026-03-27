from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from models.note_item import NoteItem


class NoteItemRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def list_for_user_and_key(
        self, *, user_id: int, experiment_key: str
    ) -> list[NoteItem]:
        async with self.session.begin():
            stmt = (
                select(NoteItem)
                .where(
                    NoteItem.user_id == user_id,
                    NoteItem.experiment_key == experiment_key,
                )
                .order_by(NoteItem.sort_order.asc(), NoteItem.created_at.asc())
            )
            result = await self.session.scalars(stmt)
            return list(result.all())

    async def create(
        self,
        *,
        user_id: int,
        experiment_key: str,
        title: str = "",
        content: str = "",
        sort_order: int = 0,
    ) -> NoteItem:
        async with self.session.begin():
            item = NoteItem(
                user_id=user_id,
                experiment_key=experiment_key,
                title=title,
                content=content,
                sort_order=sort_order,
            )
            self.session.add(item)
            await self.session.flush()
            await self.session.refresh(item)
            return item

    async def get_by_id_and_user(
        self, *, item_id: int, user_id: int
    ) -> NoteItem | None:
        async with self.session.begin():
            stmt = select(NoteItem).where(
                NoteItem.id == item_id,
                NoteItem.user_id == user_id,
            )
            return await self.session.scalar(stmt)

    async def update(
        self,
        *,
        item_id: int,
        user_id: int,
        title: str | None = None,
        content: str | None = None,
        sort_order: int | None = None,
    ) -> NoteItem | None:
        async with self.session.begin():
            stmt = select(NoteItem).where(
                NoteItem.id == item_id,
                NoteItem.user_id == user_id,
            )
            item = await self.session.scalar(stmt)
            if item is None:
                return None
            if title is not None:
                item.title = title
            if content is not None:
                item.content = content
            if sort_order is not None:
                item.sort_order = sort_order
            await self.session.flush()
            await self.session.refresh(item)
            return item

    async def delete_by_id_and_user(
        self, *, item_id: int, user_id: int
    ) -> bool:
        async with self.session.begin():
            stmt = delete(NoteItem).where(
                NoteItem.id == item_id,
                NoteItem.user_id == user_id,
            )
            result = await self.session.execute(stmt)
            return bool(getattr(result, "rowcount", 0))
