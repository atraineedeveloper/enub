
from playwright.sync_api import sync_playwright

def test_app_load():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            # Go to root, should redirect to login or dashboard
            page.goto("http://localhost:5173/")

            # Wait for network idle
            page.wait_for_load_state("networkidle")

            # Take screenshot
            page.screenshot(path="verification/app_load.png")

            print("Page loaded, title:", page.title())

        except Exception as e:
            print(f"Error: {e}")
        finally:
            browser.close()

if __name__ == "__main__":
    test_app_load()
