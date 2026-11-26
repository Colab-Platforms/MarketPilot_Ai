# MarketPilot onboarding demo (login and business setup)

A static demo of the MarketPilot onboarding flow. There is no landing page: the site opens straight on login.

## Deploy on Netlify

1. Unzip this folder.
2. In Netlify, go to **Add new site → Deploy manually** and drag the folder in.

No build step is needed. `netlify.toml` sends `/login` and `/signup` to the login page and `/setup` to the setup.

## What is in it

| File | What it is |
|---|---|
| `index.html` | Login: mobile number, 6-digit code, welcome back, saved accounts, signed in. English/Hindi switch and light/dark switch. |
| `setup/index.html` | Business setup at `/setup/`, all four paths (online business, offline shop, creator, agency) and the no-website path. |
| `favicon.svg`, `og-image.png` | Icon and link preview image. |

## Demo script (about 5 minutes)

1. Open the site. Enter any 10-digit mobile number, tap **Send code**, then type any 6 digits.
2. Tap **Set up my shop**.
3. Pick **A business**. On "How do customers buy", keep **On my website** ticked for the website path, or untick it for the offline-shop path.
4. Paste any link (for example `chumeshwarclothes.in`) and add a social link if you like. The page reads it, then shows **Is this you?** Try **Edit** on any row.
5. Continue through voice and goals to the finish screen. It lists the social pages you added.
6. Tap **Demo: try another business type** to run the creator or agency path. Tap "I don't have a website or page" on the link screen to show the manual path.

Everything is sample data, and nothing is saved to a server. "Save and exit" returns to login. "Connect your pages" and "Go to my workspace" show a short note, because those screens are not designed yet.
