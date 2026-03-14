# Universal Links Setup

The app now shares first-party Rep AI links like `https://www.repaifit.app/invite/:inviteId`.

The native app is configured for:

- `repaifit.app`
- `www.repaifit.app`

Remaining deployment work:

1. Host `/.well-known/apple-app-site-association` on your domain.
2. Host `/.well-known/assetlinks.json` on your domain when Android app links are ready.
3. Rebuild the app with EAS or `npx expo run:ios` / `npx expo run:android`.

## iOS

Create `https://www.repaifit.app/.well-known/apple-app-site-association` with:

```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appID": "YOUR_TEAM_ID.com.viralstudio.repai",
        "paths": ["/*"]
      }
    ]
  }
}
```

If `repaifit.app` serves traffic separately from `www.repaifit.app`, host the same file there too.

## Android

Create `https://www.repaifit.app/.well-known/assetlinks.json` with:

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.viralstudio.repai",
      "sha256_cert_fingerprints": ["YOUR_SHA256_FINGERPRINT"]
    }
  }
]
```

Use your signing certificate fingerprint from EAS credentials or Play Console.
