from playwright.sync_api import sync_playwright

def verify_load():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        try:
            print("Navigating to http://localhost:4173/")
            page.goto("http://localhost:4173/")
            # It should redirect to /login
            print("Waiting for login page...")
            page.wait_for_url("**/login")
            print("Login page loaded.")

            # Wait for some content to be visible
            page.wait_for_selector("input[type='email']")

            page.screenshot(path="verification_login.png")
            print("Screenshot saved to verification_login.png")
        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="error.png")
        finally:
            browser.close()

if __name__ == "__main__":
    verify_load()
