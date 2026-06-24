# expo-apirtc-options-plugin

Plugin to add apiRTC features in React Native application using Expo.
This plugin simplifies the integration of the following features:
- Screen sharing for Android and iOS
- Background blur and background image replacement for Android (via ML Kit Selfie Segmentation)

## Installation

```bash
npm install @apirtc/expo-apirtc-options-plugin
```

## Usage in app.json

Declare the plugin in your `app.json`:

```json
{
  "expo": {
    "plugins": [
      ["@apirtc/expo-apirtc-options-plugin", {
        "enableMediaProjectionService": true,
        "enableVideoEffects": true,
        "appleTeamId": "YOUR_TEAM_ID"
      }]
    ]
  }
}
```

### Options

| Parameter | Description | Default |
| --- | --- | --- |
| `enableMediaProjectionService` | Enable screen sharing on Android (MediaProjection service) | `true` |
| `enableVideoEffects` | Enable background blur and background image replacement on Android | `true` |
| `appleTeamId` | Apple Team ID used for the iOS broadcast extension | `"APPLE_TEAM_ID_NOT_SET"` |
| `logLevel` | Plugin log verbosity: `"silent"`, `"error"`, `"warn"`, `"info"`, `"debug"` | `"warn"` |

## What does this plugin do?

### Android

- Adds required permissions to `AndroidManifest.xml` for screen sharing and camera access
- Registers `AppLifecyclePackage` to handle app lifecycle events (e.g. releasing streams when the app is killed)
- When `enableVideoEffects: true`:
  - Copies native Kotlin files (`BackgroundBlurModule`, `BlurVideoProcessor`, `BackgroundImageProcessor`, `BackgroundBlurPackage`) to the Android source tree
  - Registers `BackgroundBlurPackage` in `MainApplication.kt`
  - Adds `com.google.mlkit:segmentation-selfie:16.0.0-beta6` to `app/build.gradle`

### iOS

- Adds a broadcast extension for screen sharing
- Configures the project with all modifications needed for screen sharing

## Using video effects from JavaScript (Android only)

After enabling `enableVideoEffects: true`, the `BackgroundBlurModule` native module is available:

```js
import { NativeModules, Platform } from 'react-native';
const { BackgroundBlurModule } = NativeModules;

// Enable background blur
if (Platform.OS === 'android') {
  await BackgroundBlurModule.enableBlur({
    trackId: videoTrack.id,        // video track ID from the local stream
    strong: false,                 // true for stronger blur (3 passes)
  });
}

// Enable background image replacement
if (Platform.OS === 'android') {
  await BackgroundBlurModule.enableBackgroundImage({
    trackId: videoTrack.id,
    imageUrl: 'https://example.com/background.jpg',
  });
}

// Disable any active video effect
if (Platform.OS === 'android') {
  await BackgroundBlurModule.disableBlur();
}

// Check if an effect is active
if (Platform.OS === 'android') {
  const isActive = await BackgroundBlurModule.isBlurEnabled();
}
```

## Notes

- `enableVideoEffects` is Android-only. The option is silently ignored on iOS.
- ML Kit Selfie Segmentation (`16.0.0-beta6`) is currently in beta — there is no GA release of this library.
- Background effects are applied via WebRTC's `VideoProcessor` API, so both the local preview and remote peers see the processed video.
- For persistence across sessions, save the selected effect ID with `AsyncStorage` and re-apply it after `createStreamFromUserMedia()`.

## Contributing

Contributions are welcome! Feel free to open an issue or submit a pull request on GitHub.

This plugin is maintained by [Apizee](https://www.apizee.com).
