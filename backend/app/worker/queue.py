import logging
import os
import threading
from redis import Redis
from rq import Queue
from app.core.config import settings
from app.worker.tasks import process_document_job, generate_quiz_job

logger = logging.getLogger(__name__)

def _use_redis_queue() -> bool:
    # Only use Redis/RQ when a worker is explicitly opted in.
    # Default (local dev / single-process) uses background threads so
    # documents actually reach 'ready' without a separate worker process.
    return os.getenv("USE_RQ_WORKER", "false").lower() in ("1", "true", "yes")

def get_queue():
    if not _use_redis_queue():
        return None
    try:
        redis_conn = Redis.from_url(settings.REDIS_URL, socket_connect_timeout=1, socket_timeout=1)
        redis_conn.ping()
        return Queue("docuchat", connection=redis_conn)
    except Exception as e:
        logger.warning(f"Redis not reachable for queue: {e}. Using background thread execution.")
        return None

def _run_in_thread(job, *args):
    t = threading.Thread(target=job, args=args, daemon=True)
    t.start()
    return t

def enqueue_document_processing(document_id_str: str):
    q = get_queue()
    if q:
        try:
            q.enqueue(process_document_job, document_id_str)
            logger.info(f"Enqueued document processing for {document_id_str} to Redis.")
            return
        except Exception as e:
            logger.warning(f"Failed to enqueue to Redis: {e}. Falling back to thread.")
    _run_in_thread(process_document_job, document_id_str)

def enqueue_quiz_generation(quiz_id_str: str):
    q = get_queue()
    if q:
        try:
            q.enqueue(generate_quiz_job, quiz_id_str)
            logger.info(f"Enqueued quiz generation for {quiz_id_str} to Redis.")
            return
        except Exception as e:
            logger.warning(f"Failed to enqueue to Redis: {e}. Falling back to thread.")
    _run_in_thread(generate_quiz_job, quiz_id_str)
