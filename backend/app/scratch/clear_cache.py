import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))
from app.utils.cache import invalidate_cache_prefix

invalidate_cache_prefix("dashboard_summary")
print("Cache Invalidated!")
