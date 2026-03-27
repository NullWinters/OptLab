"""
定时任务调度器 - 清理过期消息
"""

from datetime import datetime
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from dependencies import get_session
from core.chat_service import ChatService


scheduler = AsyncIOScheduler()


async def cleanup_messages_job():
    """定时任务：清理过期非活跃消息"""
    async for db in get_session():
        try:
            deleted_count = await ChatService.cleanup_old_messages(db)
            await db.commit()
            print(f"[{datetime.now()}] Cleaned up {deleted_count} old messages")
        except Exception as e:
            await db.rollback()
            print(f"[{datetime.now()}] Error cleaning up messages: {e}")
            raise


def init_scheduler():
    """初始化定时任务"""
    # 每天凌晨3点执行清理任务
    scheduler.add_job(
        cleanup_messages_job,
        trigger=CronTrigger(hour=3, minute=0),
        id="cleanup_messages",
        replace_existing=True,
    )


def start_scheduler():
    """启动调度器"""
    if not scheduler.running:
        scheduler.start()
        print("[Scheduler] Started")


def shutdown_scheduler():
    """关闭调度器"""
    if scheduler.running:
        scheduler.shutdown()
        print("[Scheduler] Shutdown")
