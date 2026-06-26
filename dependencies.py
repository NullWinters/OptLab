from models import AsyncSessionFactory
from sqlalchemy.ext.asyncio import AsyncSession

async def get_session()->AsyncSession:
    session = AsyncSessionFactory()
    try:
        yield session
    finally:
        await session.close()