"""管理员专用数据查询仓库 —— 聚合统计 / 列表 / 详情"""

from datetime import datetime
from models import AsyncSession
from models.user import User
from models.experiment_record import ExperimentRecord
from models.note_item import NoteItem
from models.chat_session import ChatSession
from sqlalchemy import func, select, text, delete, desc


class AdminRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    # ── 仪表盘统计 ──────────────────────────────────────────

    async def dashboard_stats(self) -> dict:
        async with self.session.begin():
            # 用户总数
            users_total = await self.session.scalar(
                select(func.count(User.id))
            )
            # 今日新增用户
            today_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
            users_new = await self.session.scalar(
                select(func.count(User.id)).where(User.created_at >= today_start)
            )
            # 实验记录总数
            experiments_total = await self.session.scalar(
                select(func.count(ExperimentRecord.id))
            )
            # 笔记总数
            notes_total = await self.session.scalar(
                select(func.count(NoteItem.id))
            )
            # AI 会话总数
            chats_total = await self.session.scalar(
                select(func.count(ChatSession.id))
            )
            # 今日新增实验
            experiments_today = await self.session.scalar(
                select(func.count(ExperimentRecord.id)).where(
                    ExperimentRecord.created_at >= today_start
                )
            )
            # 按实验类型分布
            exp_type_rows = await self.session.execute(
                select(
                    ExperimentRecord.source_page,
                    func.count(ExperimentRecord.id).label("cnt"),
                ).group_by(ExperimentRecord.source_page).order_by(desc("cnt")).limit(10)
            )
            experiments_by_type = [
                {"source_page": r[0] or "unknown", "count": r[1]}
                for r in exp_type_rows.all()
            ]
            # 最近注册用户
            recent_rows = await self.session.execute(
                select(User.id, User.username, User.email, User.created_at)
                .order_by(desc(User.created_at)).limit(5)
            )
            recent_users = [
                {"id": r[0], "username": r[1], "email": r[2],
                 "created_at": r[3].isoformat() if r[3] else None}
                for r in recent_rows.all()
            ]
            # 最近实验
            recent_exp_rows = await self.session.execute(
                select(
                    ExperimentRecord.id, ExperimentRecord.alias,
                    ExperimentRecord.source_page, ExperimentRecord.created_at,
                    User.username,
                ).join(User, ExperimentRecord.user_id == User.id, isouter=True)
                .order_by(desc(ExperimentRecord.created_at)).limit(5)
            )
            recent_experiments = [
                {"id": r[0], "alias": r[1], "source_page": r[2],
                 "created_at": r[3].isoformat() if r[3] else None,
                 "username": r[4] or "—"}
                for r in recent_exp_rows.all()
            ]
        return {
            "users_total": users_total,
            "users_new_today": users_new,
            "experiments_total": experiments_total,
            "experiments_today": experiments_today,
            "notes_total": notes_total,
            "chats_total": chats_total,
            "experiments_by_type": experiments_by_type,
            "recent_users": recent_users,
            "recent_experiments": recent_experiments,
        }

    # ── 用户管理 ────────────────────────────────────────────

    async def list_users(
        self, search: str = "", page: int = 1, page_size: int = 20,
    ) -> tuple[list[dict], int]:
        offset = (page - 1) * page_size
        async with self.session.begin():
            base = select(User)
            count_base = select(func.count(User.id))
            if search:
                like = f"%{search.strip()}%"
                base = base.where(
                    User.username.ilike(like) | User.email.ilike(like)
                )
                count_base = count_base.where(
                    User.username.ilike(like) | User.email.ilike(like)
                )
            total = await self.session.scalar(count_base)
            rows = await self.session.execute(
                base.order_by(desc(User.created_at)).offset(offset).limit(page_size)
            )
            users = []
            for u in rows.scalars().all():
                exp_count = await self.session.scalar(
                    select(func.count(ExperimentRecord.id)).where(
                        ExperimentRecord.user_id == u.id
                    )
                )
                note_count = await self.session.scalar(
                    select(func.count(NoteItem.id)).where(
                        NoteItem.user_id == u.id
                    )
                )
                users.append({
                    "id": u.id,
                    "username": u.username,
                    "email": u.email,
                    "created_at": u.created_at.isoformat() if u.created_at else None,
                    "experiment_count": exp_count,
                    "note_count": note_count,
                })
            return users, total

    async def get_user_detail(self, user_id: int) -> dict | None:
        async with self.session.begin():
            u = await self.session.get(User, user_id)
            if not u:
                return None
            exp_count = await self.session.scalar(
                select(func.count(ExperimentRecord.id)).where(
                    ExperimentRecord.user_id == user_id
                )
            )
            note_count = await self.session.scalar(
                select(func.count(NoteItem.id)).where(
                    NoteItem.user_id == user_id
                )
            )
            chat_count = await self.session.scalar(
                select(func.count(ChatSession.id)).where(
                    ChatSession.user_id == user_id
                )
            )
            recent_exps = await self.session.execute(
                select(ExperimentRecord.id, ExperimentRecord.alias,
                       ExperimentRecord.source_page, ExperimentRecord.created_at)
                .where(ExperimentRecord.user_id == user_id)
                .order_by(desc(ExperimentRecord.created_at)).limit(10)
            )
            exps = [
                {"id": r[0], "alias": r[1], "source_page": r[2],
                 "created_at": r[3].isoformat() if r[3] else None}
                for r in recent_exps.all()
            ]
            return {
                "id": u.id,
                "username": u.username,
                "email": u.email,
                "created_at": u.created_at.isoformat() if u.created_at else None,
                "experiment_count": exp_count,
                "note_count": note_count,
                "chat_count": chat_count,
                "recent_experiments": exps,
            }

    async def delete_user(self, user_id: int) -> bool:
        async with self.session.begin():
            u = await self.session.get(User, user_id)
            if not u:
                return False
            await self.session.execute(
                delete(ExperimentRecord).where(ExperimentRecord.user_id == user_id)
            )
            await self.session.execute(
                delete(NoteItem).where(NoteItem.user_id == user_id)
            )
            await self.session.execute(
                delete(ChatSession).where(ChatSession.user_id == user_id)
            )
            await self.session.delete(u)
            return True

    # ── 实验管理 ────────────────────────────────────────────

    async def list_experiments(
        self, source_page: str = "", user_id: str = "",
        page: int = 1, page_size: int = 20,
    ) -> tuple[list[dict], int]:
        offset = (page - 1) * page_size
        async with self.session.begin():
            base = select(ExperimentRecord)
            count_base = select(func.count(ExperimentRecord.id))
            if source_page:
                base = base.where(ExperimentRecord.source_page == source_page)
                count_base = count_base.where(ExperimentRecord.source_page == source_page)
            if user_id:
                try:
                    uid = int(user_id)
                    base = base.where(ExperimentRecord.user_id == uid)
                    count_base = count_base.where(ExperimentRecord.user_id == uid)
                except ValueError:
                    pass
            total = await self.session.scalar(count_base)
            rows = await self.session.execute(
                base.order_by(desc(ExperimentRecord.created_at))
                .offset(offset).limit(page_size)
            )
            records = []
            for e in rows.scalars().all():
                username = None
                if e.user_id:
                    u = await self.session.get(User, e.user_id)
                    username = u.username if u else None
                records.append({
                    "id": e.id,
                    "alias": e.alias,
                    "source_page": e.source_page,
                    "user_id": e.user_id,
                    "username": username or "—",
                    "payload": e.payload,
                    "created_at": e.created_at.isoformat() if e.created_at else None,
                })
            return records, total

    async def delete_experiment(self, record_id: int) -> bool:
        async with self.session.begin():
            e = await self.session.get(ExperimentRecord, record_id)
            if not e:
                return False
            await self.session.delete(e)
            return True

    # ── 笔记只读查询 ───────────────────────────────────────

    async def list_notes(
        self, experiment_key: str = "", user_id: str = "",
        page: int = 1, page_size: int = 20,
    ) -> tuple[list[dict], int]:
        offset = (page - 1) * page_size
        async with self.session.begin():
            base = select(NoteItem)
            count_base = select(func.count(NoteItem.id))
            if experiment_key:
                base = base.where(NoteItem.experiment_key == experiment_key)
                count_base = count_base.where(NoteItem.experiment_key == experiment_key)
            if user_id:
                try:
                    uid = int(user_id)
                    base = base.where(NoteItem.user_id == uid)
                    count_base = count_base.where(NoteItem.user_id == uid)
                except ValueError:
                    pass
            total = await self.session.scalar(count_base)
            rows = await self.session.execute(
                base.order_by(desc(NoteItem.updated_at))
                .offset(offset).limit(page_size)
            )
            notes = []
            for n in rows.scalars().all():
                username = None
                if n.user_id:
                    u = await self.session.get(User, n.user_id)
                    username = u.username if u else None
                notes.append({
                    "id": n.id,
                    "title": n.title,
                    "experiment_key": n.experiment_key,
                    "user_id": n.user_id,
                    "username": username or "—",
                    "content_preview": (n.content[:200] + "..." if n.content and len(n.content) > 200 else n.content),
                    "created_at": n.created_at.isoformat() if n.created_at else None,
                    "updated_at": n.updated_at.isoformat() if n.updated_at else None,
                })
            return notes, total

    async def get_note_detail(self, note_id: int) -> dict | None:
        async with self.session.begin():
            n = await self.session.get(NoteItem, note_id)
            if not n:
                return None
            username = None
            if n.user_id:
                u = await self.session.get(User, n.user_id)
                username = u.username if u else None
            return {
                "id": n.id,
                "title": n.title,
                "experiment_key": n.experiment_key,
                "user_id": n.user_id,
                "username": username or "—",
                "content": n.content or "",
                "sort_order": n.sort_order,
                "created_at": n.created_at.isoformat() if n.created_at else None,
                "updated_at": n.updated_at.isoformat() if n.updated_at else None,
            }

    async def delete_note(self, note_id: int) -> bool:
        async with self.session.begin():
            n = await self.session.get(NoteItem, note_id)
            if not n:
                return False
            await self.session.delete(n)
            return True

    # ── 聊天会话管理 ───────────────────────────────────────

    async def list_chats(
        self, user_id: str = "", page: int = 1, page_size: int = 20,
    ) -> tuple[list[dict], int]:
        offset = (page - 1) * page_size
        async with self.session.begin():
            base = select(ChatSession)
            count_base = select(func.count(ChatSession.id))
            if user_id:
                try:
                    uid = int(user_id)
                    base = base.where(ChatSession.user_id == uid)
                    count_base = count_base.where(ChatSession.user_id == uid)
                except ValueError:
                    pass
            total = await self.session.scalar(count_base)
            rows = await self.session.execute(
                base.order_by(desc(ChatSession.updated_at))
                .offset(offset).limit(page_size)
            )
            chats = []
            for c in rows.scalars().all():
                username = None
                if c.user_id:
                    u = await self.session.get(User, c.user_id)
                    username = u.username if u else None
                chats.append({
                    "id": str(c.id),
                    "user_id": c.user_id,
                    "username": username or "—",
                    "page_id": c.page_id,
                    "is_active": c.is_active,
                    "message_count": c.message_count,
                    "created_at": c.created_at.isoformat() if c.created_at else None,
                    "updated_at": c.updated_at.isoformat() if c.updated_at else None,
                })
            return chats, total

    # ── 系统状态 ────────────────────────────────────────────

    async def system_status(self) -> dict:
        async with self.session.begin():
            try:
                await self.session.execute(text("SELECT 1"))
                db_ok = True
            except Exception:
                db_ok = False
            db_uri = self.session.bind.url.render_as_string(hide_password=True) if self.session.bind else "unknown"
        return {
            "database": {
                "ok": db_ok,
                "uri": db_uri,
            }
        }
