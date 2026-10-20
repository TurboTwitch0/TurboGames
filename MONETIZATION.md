# Enable advertising on TurboGames

The site has one responsive Google AdSense display placement above the catalog,
separated from game controls and labeled Advertisement. It is disabled by default.
It does not insert ads into third-party game files, block gameplay, refresh ads on
search/game clicks, or claim that a five-second view earns money. An ad failing to
load never prevents games from opening. Embedded Google Sites views do not load ads.

## Required account setup

1. Apply at https://adsense.google.com/ using an eligible account. If you are under
   18, an eligible parent or guardian must own the account and receive payments.
2. Add your hosted site, https://turbogamesv1.netlify.app/, and follow Google's
   current site-verification and approval steps. Domain ownership and a game
   collection do not establish permission to monetize every third-party game:
   confirm your publishing/monetization rights before submitting the site.
3. Complete Google's identity, tax and payment setup in its dashboard. Do not
   send passwords, tax documents, payment details or private tokens to this project.
4. Set up the privacy disclosures and Google's required consent solution for
   your visitors. This code does not replace a consent management platform.
5. After approval, create a responsive Display ad unit. Keep Auto ads disabled
   if you want only the placement configured here.
6. Copy your public publisher ID and ad slot ID into ads-config.js. Set enabled
   to true only after approval and privacy/consent setup are complete.
7. Create ads.txt at the published site root using the exact authorized-seller
   line provided by your AdSense account. No invented publisher ID is included.
8. Deploy the changes to Netlify. The GitHub repository alone is not a deployment
   unless your Netlify project is connected to it.

## Earnings and five-second ads

AdSense decides which ads are eligible and how impressions/clicks are paid.
There is no guaranteed payment per visitor or per five seconds. Earnings and payout
thresholds are shown by the provider, not by a made-up balance in this website.
Do not click your own ads, ask players to click, or generate automated ad traffic.
A timed video/interstitial would require a provider that approves that game-ad
format and supplies an SDK; a custom five-second countdown is not that integration.

## Configuration

    window.TURBO_ADS_CONFIG = Object.freeze({
      enabled: false,
      publisherId: "", // Replace with your actual public ca-pub- ID.
      slotId: ""       // Replace with your actual display ad slot ID.
    });

There is no advertising-account plugin available in this workspace. Account
approval and payout setup must be completed directly with the provider. Public
publisher/ad-unit IDs are sufficient to finish wiring this prepared integration.
