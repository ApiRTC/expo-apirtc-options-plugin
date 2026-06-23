//
//  Use this file to import your target's public headers that you would like to expose to Swift.
//

// React Native <= 0.75: source-based pods, headers available via HEADER_SEARCH_PATHS
// React Native >= 0.76: prebuilt XCFramework, headers only accessible via module import
#if __has_include("React/RCTEventEmitter.h")
  #import "React/RCTEventEmitter.h"
#else
  @import React;
#endif
