from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path


def _ensure_playwright_chromium_installed() -> None:
    """
    Playwright's Python package does not ship browsers by default.
    This installs Chromium on-demand for reproducible screenshots.
    """
    subprocess.run(
        [sys.executable, "-m", "playwright", "install", "chromium"],
        check=True,
    )


async def _run(
    *,
    width: int,
    height: int,
    out_dir: Path,
    wait_ms: int,
) -> None:
    from playwright.async_api import async_playwright

    base_dir = Path(__file__).resolve().parents[1]
    designs_dir = base_dir / "designs"

    targets: list[tuple[str, Path]] = [
        ("home", designs_dir / "home.html"),
        ("routine", designs_dir / "routine.html"),
        ("me", designs_dir / "me.html"),
    ]

    out_dir.mkdir(parents=True, exist_ok=True)

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            viewport={"width": width, "height": height},
            device_scale_factor=1,
        )

        try:
            page = await context.new_page()
            for name, html_path in targets:
                if not html_path.exists():
                    raise FileNotFoundError(str(html_path))

                await page.goto(html_path.as_uri(), wait_until="networkidle")
                # Make captures deterministic: fonts loaded + no in-flight animations.
                await page.add_style_tag(
                    content="""
                    *, *::before, *::after {
                        animation: none !important;
                        transition: none !important;
                        caret-color: transparent !important;
                    }
                    """
                )
                await page.evaluate(
                    """
                    () => (document.fonts && document.fonts.ready)
                        ? document.fonts.ready
                        : Promise.resolve()
                    """
                )
                if wait_ms > 0:
                    await page.wait_for_timeout(wait_ms)

                await page.screenshot(
                    path=str(out_dir / f"{name}.png"),
                    full_page=False,
                )
        finally:
            await context.close()
            await browser.close()


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Reproduce SiSy design screenshots (no _mobile suffix)."
    )
    parser.add_argument(
        "--width",
        type=int,
        default=390,
        help="Viewport width in CSS pixels (default: 390).",
    )
    parser.add_argument(
        "--height",
        type=int,
        default=844,
        help="Viewport height in CSS pixels (default: 844).",
    )
    parser.add_argument(
        "--out-dir",
        type=Path,
        default=Path(__file__).resolve().parents[1] / "designs" / "screenshots",
        help="Output directory for screenshots.",
    )
    parser.add_argument(
        "--wait-ms",
        type=int,
        default=300,
        help="Extra wait after network idle (default: 300ms).",
    )
    parser.add_argument(
        "--skip-browser-install",
        action="store_true",
        help="Skip auto-installing Playwright Chromium.",
    )
    args = parser.parse_args()

    if not args.skip_browser_install:
        _ensure_playwright_chromium_installed()

    import asyncio

    asyncio.run(
        _run(
            width=args.width,
            height=args.height,
            out_dir=args.out_dir,
            wait_ms=args.wait_ms,
        )
    )


if __name__ == "__main__":
    main()

