import {
  withXcodeProject,
  ConfigPlugin,
  InfoPlist,
  withDangerousMod,
  XcodeProject,
  withEntitlementsPlist,
  withInfoPlist,
  ExportedConfigWithProps
} from '@expo/config-plugins';

import plist from '@expo/plist';
import * as fs from 'fs';
import * as path from 'path';
import * as util from 'util';

const quoted = (str: string) => {
  return util.format(`"%s"`, str);
}

type PluginProps = {
  enableMediaProjectionService?: boolean,
  appleTeamId?: string
};

const withIosBroadcastExtension: ConfigPlugin<PluginProps> = (config, props) => {

    console.log('withIosBroadcastExtension called with props:', props);

    config = withAppEntitlements(config);
    config = withInfoPlistRTC(config);
    config = withBroadcastExtensionXcodeTarget(config, props);
    config = withBroadcastExtensionPlist(config);
    //TODO Suite à relire
    return config;
};

const withAppEntitlements: ConfigPlugin = (config) => {

    config = withEntitlementsPlist(config, (config) => {
        const appGroupIdentifier = `group.${config.ios!.bundleIdentifier!}.screenSharing-Extension`;
        config.modResults['com.apple.security.application-groups'] = [
            appGroupIdentifier,
        ];
        return config;
    });
    return config;
};

const withInfoPlistRTC: ConfigPlugin = (config) => {
    return withInfoPlist(config, (config) => {
        const appGroupIdentifier = `group.${config.ios!.bundleIdentifier!}.screenSharing-Extension`;
        const extensionBundleIdentifier = `${config.ios!.bundleIdentifier!}.screenSharing-Extension`;
    
        config.modResults['RTCAppGroupIdentifier'] = appGroupIdentifier;
        config.modResults['RTCScreenSharingExtension'] = extensionBundleIdentifier;

        if (!config.modResults['UIBackgroundModes']) {
            config.modResults['UIBackgroundModes'] = [];
        }
        config.modResults['UIBackgroundModes'].push('voip');
        config.modResults['UIBackgroundModes'].push('audio');
        config.modResults['UIBackgroundModes'].push('fetch');
        config.modResults['UIBackgroundModes'].push('processing');
        config.modResults['UIBackgroundModes'].push('remote-notification');

        config.modResults['NSCameraUsageDescription'] = 'Camera permission description F';
        config.modResults['NSMicrophoneUsageDescription'] = 'Microphone permission description F';

        return config;
    });
};

const withBroadcastExtensionPlist: ConfigPlugin = (config) => {
    return withDangerousMod(config, [
      'ios',
      async (config) => {
        const extensionRootPath = path.join(
          config.modRequest.platformProjectRoot,
          'screenSharing_Extension'
        );
        const extensionPlistPath = path.join(extensionRootPath, 'Info.plist');
  
        const extensionPlist: InfoPlist = {
          NSExtension: {
            NSExtensionPointIdentifier: 'com.apple.broadcast-services-upload',
            NSExtensionPrincipalClass: '$(PRODUCT_MODULE_NAME).SampleHandler',
            RPBroadcastProcessMode: 'RPBroadcastProcessModeSampleBuffer',
          },
        };
  
        await fs.promises.mkdir(path.dirname(extensionPlistPath), {
          recursive: true,
        });
        await fs.promises.writeFile(
          extensionPlistPath,
          plist.build(extensionPlist)
        );
  
        return config;
      },
    ]);
};

const withBroadcastExtensionXcodeTarget: ConfigPlugin<PluginProps> = (config, props) => {

  return withXcodeProject(config, async (config) => {

    const appName = config.modRequest.projectName!;
    const extensionName = 'screenSharing_Extension';
    const extensionBundleIdentifier = `${config.ios!.bundleIdentifier!}.screenSharing-Extension`;
    const currentProjectVersion = config.ios!.buildNumber || '1';
    const marketingVersion = config.version!;

    let updatedProj = addBroadcastExtensionXcodeTarget(config.modResults, {
        appName,
        extensionName,
        extensionBundleIdentifier,
        currentProjectVersion,
        marketingVersion,
        appleTeamId: props.appleTeamId,
    });

    addBroadcastEntitlements(updatedProj, config, props.appleTeamId);
    addExtensionSources(updatedProj, config);
    return config;
  });
};

type AddXcodeTargetParams = {
    appName: string;
    extensionName: string;
    extensionBundleIdentifier: string;
    currentProjectVersion: string;
    marketingVersion: string;
    appleTeamId?: string; // <-- Ajoute ici
};

const addBroadcastExtensionXcodeTarget = (
        proj: XcodeProject,
        {
          appName,
          extensionName,
          extensionBundleIdentifier,
          currentProjectVersion,
          marketingVersion,
          appleTeamId,
        }: AddXcodeTargetParams
    ) => {

    if (proj.getFirstProject().firstProject.targets?.length > 1) {
        console.error("addBroadcastExtensionXcodeTarget targets?.length > 1");
        return;
    }
  
    const targetUuid = proj.generateUuid();
    const groupName = 'Embed App Extensions';
  
    const xCConfigurationList = addXCConfigurationList(proj, {
      extensionBundleIdentifier,
      currentProjectVersion,
      marketingVersion,
      extensionName,
      appName,
      appleTeamId,
    });
  
    const productFile = addProductFile(proj, extensionName, groupName);
  
    const target = addToPbxNativeTargetSection(proj, {
      extensionName,
      targetUuid,
      productFile,
      xCConfigurationList,
    });
  
    addToPbxProjectSection(proj, target);
  
    addTargetDependency(proj, target);
  
    const frameworkFile = proj.addFramework('ReplayKit.framework', {
      target: target.uuid,
      link: false,
    });
    const frameworkPath = frameworkFile.path;
    //console.log(`Added ReplayKit.framework to target ${target.uuid}`);
  
    addBuildPhases(proj, {
      groupName,
      productFile,
      targetUuid,
      frameworkPath,
    });
  
    addPbxGroup(proj, productFile);

    return proj;
};

const addXCConfigurationList = (
    proj: XcodeProject,
    {
      extensionBundleIdentifier,
      currentProjectVersion,
      marketingVersion,
      extensionName,
      appName,
      appleTeamId, 
    }: AddXcodeTargetParams
  ) => {
    const commonBuildSettings: any = {
      CLANG_ANALYZER_NONNULL: 'YES',
      CLANG_ANALYZER_NUMBER_OBJECT_CONVERSION: 'YES_AGGRESSIVE',
      CLANG_CXX_LANGUAGE_STANDARD: quoted('gnu++17'),
      CLANG_ENABLE_OBJC_WEAK: 'YES',
      CLANG_WARN_DOCUMENTATION_COMMENTS: 'YES',
      CLANG_WARN_QUOTED_INCLUDE_IN_FRAMEWORK_HEADER: 'YES',
      CLANG_WARN_UNGUARDED_AVAILABILITY: 'YES_AGGRESSIVE',
      DEVELOPMENT_TEAM: appleTeamId ? quoted(appleTeamId) : undefined, // <-- Ajoute ici
      CODE_SIGN_ENTITLEMENTS: `${appName}/${appName}.entitlements`,
      CODE_SIGN_STYLE: 'Automatic',
      CURRENT_PROJECT_VERSION: currentProjectVersion,
      GCC_C_LANGUAGE_STANDARD: 'gnu11',
      GENERATE_INFOPLIST_FILE: 'YES',
      INFOPLIST_FILE: `${extensionName}/Info.plist`,
      INFOPLIST_KEY_CFBundleDisplayName: `${extensionName}`,
      INFOPLIST_KEY_NSHumanReadableCopyright: quoted(''),
      IPHONEOS_DEPLOYMENT_TARGET: '15.1',
      LD_RUNPATH_SEARCH_PATHS: quoted(
        '$(inherited) @executable_path/Frameworks @executable_path/../../Frameworks'
      ),
      MARKETING_VERSION: marketingVersion,
      MTL_FAST_MATH: 'YES',
      PRODUCT_BUNDLE_IDENTIFIER: quoted(extensionBundleIdentifier),
      PRODUCT_NAME: quoted('$(TARGET_NAME)'),
      SKIP_INSTALL: 'YES',
      SWIFT_EMIT_LOC_STRINGS: 'YES',
      SWIFT_VERSION: '5.0',
      TARGETED_DEVICE_FAMILY: quoted('1,2'),
      //SWIFT_OBJC_BRIDGING_HEADER: `reactNativeApiRTC-Bridging-Header.h`,
    };
  
    const buildConfigurationsList = [
      {
        name: 'Debug',
        isa: 'XCBuildConfiguration',
        buildSettings: {
          ...commonBuildSettings,
          DEBUG_INFORMATION_FORMAT: 'dwarf',
          MTL_ENABLE_DEBUG_INFO: 'INCLUDE_SOURCE',
          SWIFT_ACTIVE_COMPILATION_CONDITIONS: 'DEBUG',
          SWIFT_OPTIMIZATION_LEVEL: quoted('-Onone'),
        },
      },
      {
        name: 'Release',
        isa: 'XCBuildConfiguration',
        buildSettings: {
          ...commonBuildSettings,
          COPY_PHASE_STRIP: 'NO',
          DEBUG_INFORMATION_FORMAT: quoted('dwarf-with-dsym'),
          SWIFT_OPTIMIZATION_LEVEL: quoted('-Owholemodule'),
        },
      },
    ];
  
    const xCConfigurationList = proj.addXCConfigurationList(
      buildConfigurationsList,
      'Release',
      `Build configuration list for PBXNativeTarget ${quoted(extensionName)}`
    );
  
    //console.log(`Added XCConfigurationList ${xCConfigurationList.uuid}`);
  
    // update other build properties
    proj.updateBuildProperty(
      'ALWAYS_EMBED_SWIFT_STANDARD_LIBRARIES',
      'YES',
      null,
      proj.getFirstTarget().firstTarget.name
    );
  
    proj.updateBuildProperty('IPHONEOS_DEPLOYMENT_TARGET', '15.1');
  
    return xCConfigurationList;
};
  
const addProductFile = (
    proj: XcodeProject,
    extensionName: string,
    groupName: string
  ) => {
    const productFile = {
      basename: `${extensionName}.appex`,
      fileRef: proj.generateUuid(),
      uuid: proj.generateUuid(),
      group: groupName,
      explicitFileType: 'wrapper.app-extension',
      settings: {
        ATTRIBUTES: ['RemoveHeadersOnCopy'],
      },
      includeInIndex: 0,
      path: `${extensionName}.appex`,
      sourceTree: 'BUILT_PRODUCTS_DIR',
    };
  
    proj.addToPbxFileReferenceSection(productFile);
    //console.log(`Added PBXFileReference: ${productFile.fileRef}`);
  
    proj.addToPbxBuildFileSection(productFile);
    //console.log(`Added PBXBuildFile: ${productFile.fileRef}`);
  
    return productFile;
};
  
const addToPbxNativeTargetSection = (
    proj: XcodeProject,
    {
      extensionName,
      targetUuid,
      productFile,
      xCConfigurationList,
    }: {
      extensionName: string;
      targetUuid: string;
      productFile: any;
      xCConfigurationList: any;
    }
  ) => {
    const target = {
      uuid: targetUuid,
      pbxNativeTarget: {
        isa: 'PBXNativeTarget',
        buildConfigurationList: xCConfigurationList.uuid,
        buildPhases: [],
        buildRules: [],
        dependencies: [],
        name: extensionName,
        productName: extensionName,
        productReference: productFile.fileRef,
        productType: quoted('com.apple.product-type.app-extension'),
      },
    };
  
    proj.addToPbxNativeTargetSection(target);
    //console.log(`Added PBXNativeTarget ${target.uuid}`);
    return target;
};
  
const addToPbxProjectSection = (proj: XcodeProject, target: any) => {
    proj.addToPbxProjectSection(target);
  
    //console.log(`Added target to pbx project section ${target.uuid}`);
  
    // Add target attributes to project section
    if (
      !proj.pbxProjectSection()[proj.getFirstProject().uuid].attributes
        .TargetAttributes
    ) {
      proj.pbxProjectSection()[
        proj.getFirstProject().uuid
      ].attributes.TargetAttributes = {};
    }
  
    proj.pbxProjectSection()[
      proj.getFirstProject().uuid
    ].attributes.LastSwiftUpdateCheck = 1340;
  
    proj.pbxProjectSection()[
      proj.getFirstProject().uuid
    ].attributes.TargetAttributes[target.uuid] = {
      CreatedOnToolsVersion: '13.4.1',
      ProvisioningStyle: 'Automatic',
    };
};
  
const addTargetDependency = (proj: XcodeProject, target: any) => {
    if (!proj.hash.project.objects['PBXTargetDependency']) {
      proj.hash.project.objects['PBXTargetDependency'] = {};
    }
    if (!proj.hash.project.objects['PBXContainerItemProxy']) {
      proj.hash.project.objects['PBXContainerItemProxy'] = {};
    }
  
    proj.addTargetDependency(proj.getFirstTarget().uuid, [target.uuid]);
  
    //console.log(`Added target dependency for target ${target.uuid}`);
};
  
type AddBuildPhaseParams = {
  groupName: string;
  productFile: any;
  targetUuid: string;
  frameworkPath: string;
};
  
const addBuildPhases = (proj: XcodeProject,{ groupName, productFile, targetUuid, frameworkPath }: AddBuildPhaseParams) => {
  const buildPath = quoted('');

  // Sources build phase
  const { uuid: sourcesBuildPhaseUuid } = proj.addBuildPhase(
    [`SampleHandler.swift`, 'Atomic.swift', 'DarwinNotificationCenter.swift', 'SampleUploader.swift', 'SocketConnection.swift','screenSharing_Extension.entitlements'],
    'PBXSourcesBuildPhase',
    'Sources',
    targetUuid,
    'app_extension',
    buildPath
  );
  //console.log(`Added PBXSourcesBuildPhase ${sourcesBuildPhaseUuid}`);
  
  // Copy files build phase
  const { uuid: copyFilesBuildPhaseUuid } = proj.addBuildPhase(
    [productFile.path],
    'PBXCopyFilesBuildPhase',
    groupName,
    proj.getFirstTarget().uuid,
    'app_extension',
    buildPath
  );
  //console.log(`Added PBXCopyFilesBuildPhase ${copyFilesBuildPhaseUuid}`);
  
  // Frameworks build phase
  const { uuid: frameworksBuildPhaseUuid } = proj.addBuildPhase(
    [frameworkPath],
    'PBXFrameworksBuildPhase',
    'Frameworks',
    targetUuid,
    'app_extension',
    buildPath
  );
  //console.log(`Added PBXFrameworksBuildPhase ${frameworksBuildPhaseUuid}`);
  
  // Resources build phase
  const { uuid: resourcesBuildPhaseUuid } = proj.addBuildPhase(
    [],
    'PBXResourcesBuildPhase',
    'Resources',
    targetUuid,
    'app_extension',
    buildPath
  );
  //console.log(`Added PBXResourcesBuildPhase ${resourcesBuildPhaseUuid}`);
};
  
const addPbxGroup = (proj: XcodeProject, productFile: any) => {

    // Add PBX group
    const { uuid: pbxGroupUuid } = proj.addPbxGroup(
      ['SampleHandler.swift', 'Atomic.swift', 'DarwinNotificationCenter.swift', 'SampleUploader.swift', 'SocketConnection.swift','screenSharing_Extension.entitlements'],
      'screenSharing_Extension',
      'screenSharing_Extension'
    );

    //console.log(`Added PBXGroup ${pbxGroupUuid}`);
  
    // Add PBXGroup to top level group
    const groups = proj.hash.project.objects['PBXGroup'];
    if (pbxGroupUuid) {
      Object.keys(groups).forEach(function (key) {
        if (groups[key].name === undefined && groups[key].path === undefined) {
          proj.addToPbxGroup(pbxGroupUuid, key);
          //console.log(`Added PBXGroup ${pbxGroupUuid} root PBXGroup group ${key}`);
        } else if (groups[key].name === 'Products') {
          proj.addToPbxGroup(productFile, key);
          //console.log(`Added broadcast.apex to Products PBXGroup`);
        }
      });
    }
};

const addBroadcastEntitlements = async (proj: XcodeProject, config: ExportedConfigWithProps<XcodeProject>, appleTeamId: string | undefined) => {

    const appGroupIdentifier = `group.${config.ios!.bundleIdentifier!}.screenSharing-Extension`;
    const extensionRootPath = path.join(config.modRequest.platformProjectRoot,'screenSharing_Extension');
    const entitlementsPath = path.join(extensionRootPath,'screenSharing_Extension.entitlements');

    const extensionEntitlements: InfoPlist = {
      'com.apple.security.application-groups': [appGroupIdentifier],
      'com.apple.developer.team-identifier': appleTeamId,
    };

    // create file
    await fs.promises.mkdir(path.dirname(entitlementsPath), {recursive: true,});
    await fs.promises.writeFile(
      entitlementsPath,
      plist.build(extensionEntitlements)
    );

    const targetUuid = proj.findTargetKey('screenSharing_Extension');
    const groupUuid = proj.findPBXGroupKey({ name: 'screenSharing_Extension' });

    proj.addFile('screenSharing_Extension.entitlements', groupUuid, {
      target: targetUuid,
      lastKnownFileType: 'text.plist.entitlements',
    });

    // update build properties
    proj.updateBuildProperty(
      'CODE_SIGN_ENTITLEMENTS',
      'screenSharing_Extension/screenSharing_Extension.entitlements',
      null,
      'screenSharing_Extension'
    );
};

const addExtensionSources = async (proj: XcodeProject, config: ExportedConfigWithProps<XcodeProject>) => {

    const appGroupIdentifier = `group.${config.ios!
    .bundleIdentifier!}.screenSharing-Extension`;
    const extensionRootPath = path.join(
    config.modRequest.platformProjectRoot,
    'screenSharing_Extension',
    );
    const platformProjectRootPath = path.join(
      config.modRequest.platformProjectRoot,
    );
    await fs.promises.mkdir(extensionRootPath, { recursive: true });
    await fs.promises.copyFile(
        path.join(__dirname, 'static', 'Atomic.swift'),
        path.join(extensionRootPath, 'Atomic.swift')
    );

    await fs.promises.copyFile(
        path.join(__dirname, 'static', 'DarwinNotificationCenter.swift'),
        path.join(extensionRootPath, 'DarwinNotificationCenter.swift')
    );
    // Override SampleHandler.swift initial template
    await fs.promises.copyFile(
        path.join(__dirname, 'static', 'SampleHandler.swift'),
        path.join(extensionRootPath, 'SampleHandler.swift')
    );
    await fs.promises.copyFile(
        path.join(__dirname, 'static', 'SampleUploader.swift'),
        path.join(extensionRootPath, 'SampleUploader.swift')
    );
    await fs.promises.copyFile(
        path.join(__dirname, 'static', 'SocketConnection.swift'),
        path.join(extensionRootPath, 'SocketConnection.swift')
    );

    // Update app group bundle id in SampleHandler code
    const code = await fs.promises.readFile(
        path.join(extensionRootPath, 'SampleHandler.swift'),
        { encoding: 'utf-8' }
    );
    await fs.promises.writeFile(
        path.join(extensionRootPath, 'SampleHandler.swift'),
        code.replace('group.apirtc.reactNativeApiRTC.broadcast', appGroupIdentifier)
    );

    addSourceFiles(proj, extensionRootPath);
};

const addSourceFiles = (proj: XcodeProject, extensionRootPath: string) => {

    const targetUuid = proj.findTargetKey('screenSharing_Extension');
    const groupUuid = proj.findPBXGroupKey({ name: 'screenSharing_Extension' });

    if (!targetUuid) {
        console.error(`Failed to find "screenSharing_Extension" target!`);
        return;
    }
    if (!groupUuid) {
        console.error(`Failed to find "screenSharing_Extension" group!`);
        return;
    }
    
    proj.addSourceFile(
        'Atomic.swift',
        {
        target: targetUuid,
        },
        groupUuid
    );
    
    proj.addSourceFile(
        'DarwinNotificationCenter.swift',
        {
        target: targetUuid,
        },
        groupUuid
    );

    proj.addSourceFile(
        'SampleHandler.swift',
        {
            target: targetUuid,
        },
        groupUuid
    );

    proj.addSourceFile(
        'SampleUploader.swift',
        {
        target: targetUuid,
        },
        groupUuid
    );
    
    proj.addSourceFile(
        'SocketConnection.swift',
        {
        target: targetUuid,
        },
        groupUuid
    );
};

export default withIosBroadcastExtension;