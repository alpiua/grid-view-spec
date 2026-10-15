"""Shared configuration and runner for browser tests."""

from __future__ import annotations

import os
import shutil
import subprocess
from pathlib import Path

import pytest

DEFAULT_BROWSER_TIMEOUT = 30


def require_chromium() -> str:
    """Return a Chromium or Google Chrome executable path or skip the calling test."""
    for candidate in (
        "google-chrome-stable",
        "google-chrome",
        "chromium",
        "chromium-browser",
        "chrome",
    ):
        path = shutil.which(candidate)
        if path:
            return path
    pytest.skip("Chromium or Google Chrome is required for browser rendering")


def run_headless_chromium(
    chromium: str,
    page: Path,
    tmp_path: Path,
    *,
    virtual_time_budget: int = 3000,
    timeout: int = DEFAULT_BROWSER_TIMEOUT,
    url_query: str = "",
) -> subprocess.CompletedProcess[str]:
    """Execute Chromium headlessly with required isolation and non-interactive flags."""
    profile_dir = tmp_path / "chromium-profile"
    env = {k: v for k, v in os.environ.items() if k != "DBUS_SESSION_BUS_ADDRESS"}
    return subprocess.run(
        [
            chromium,
            "--headless",
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--no-zygote",
            "--disable-gpu",
            "--disable-dev-shm-usage",
            "--no-first-run",
            "--no-default-browser-check",
            "--allow-file-access-from-files",
            "--password-store=basic",
            "--use-mock-keychain",
            f"--user-data-dir={profile_dir}",
            f"--virtual-time-budget={virtual_time_budget}",
            "--dump-dom",
            page.as_uri() + url_query,
        ],
        env=env,
        text=True,
        capture_output=True,
        timeout=timeout,
        check=False,
    )
