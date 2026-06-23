
import { ConfigPlugin, withXcodeProject } from '@expo/config-plugins';
import * as path from 'path';
import * as fs from 'fs';

type PluginProps = {
  enableMediaProjectionService?: boolean;
};

const NATIVE_FILES = [
  'ReactNativeApiRTC_RPK.swift',
  'ReactNativeApiRTC_RPK.m',
  'reactNativeApiRTCExpo.entitlements'
];
const BRIDGING_FILES = [
  'reactNativeApiRTCExpo-Bridging-Header.h',
];

const BRIDGING_HEADER = 'reactNativeApiRTCExpo-Bridging-Header.h';

function copyNativeFiles(projectRoot: string, iosProjectName: string) {
  const nativeSrcPath = path.join(projectRoot, 'node_modules/@apirtc/expo-apirtc-options-plugin/build/static');
  //const nativeSrcPath = path.join('static');
  const iosPath = path.join(projectRoot, 'ios', iosProjectName);

  for (const file of NATIVE_FILES) {
    const src = path.join(nativeSrcPath, file);
    const dest = path.join(iosPath, file);

    if (!fs.existsSync(src)) {
      console.warn(`⚠️ Fichier manquant : ${src}`);
      continue;
    }

    fs.copyFileSync(src, dest);
    console.log(`📄 Copié : ${file}`);
  }
}

function copyBridgingFiles(projectRoot: string, iosProjectName: string) {
  const nativeSrcPath = path.join(projectRoot, 'node_modules/@apirtc/expo-apirtc-options-plugin/build/static');
  const iosPath = path.join(projectRoot, 'ios', iosProjectName);

  for (const file of BRIDGING_FILES) {
    const src = path.join(nativeSrcPath, file);
    const dest = path.join(iosPath, file);

    if (!fs.existsSync(src)) {
      console.warn(`⚠️ Fichier manquant : ${src}`);
      continue;
    }

    fs.copyFileSync(src, dest);
    console.log(`📄 Copié : ${file}`);
  }
}

const withNativeFilesPlugin: ConfigPlugin<PluginProps> = (config) => {
  return withXcodeProject(config, (config) => {
    const project = config.modResults;
    const projectRoot = config.modRequest.projectRoot;
    const iosProjectName = config.modRequest.projectName!;
    const iosDir = path.join(projectRoot, 'ios');
    const nativeGroup = project.getFirstProject().firstProject.mainGroup;

    copyNativeFiles(projectRoot, iosProjectName);
    copyBridgingFiles(projectRoot, iosProjectName);

    // Trouve la section Sources (PBXSourcesBuildPhase)
    const buildPhases = project.hash.project.objects['PBXSourcesBuildPhase'];
    const buildPhaseEntry = Object.entries(buildPhases).find(
      ([key, val]: [string, any]) =>
        key !== 'isa' && val?.isa === 'PBXSourcesBuildPhase'
    );
    if (!buildPhaseEntry) {
      throw new Error('❌ PBXSourcesBuildPhase non trouvé dans le projet Xcode.');
    }

    const [sourcesBuildPhaseUuid, sourcesBuildPhase] = buildPhaseEntry;

    (sourcesBuildPhase as any).files = (sourcesBuildPhase as any).files || [];

    for (const fileName of NATIVE_FILES) {
      const filePath = path.join(iosDir, iosProjectName, fileName);

      if (!fs.existsSync(filePath)) {
        console.warn(`⚠️  Fichier natif introuvable : ${filePath}`);
        continue;
      }

      const file = project.addFile(
        path.join(iosProjectName, fileName),
        nativeGroup
      );

      if (!file?.fileRef) {
        console.warn(`❌ Échec de l'ajout de : ${fileName}`);
        continue;
      }

      // Vérifie s’il est déjà présent
      const alreadyExists = (sourcesBuildPhase as any).files.some(
        (f: any) => f?.comment === `${fileName} in Sources`
      );
      if (alreadyExists) continue;

      // Crée un buildFile
      const buildFileUuid = project.generateUuid();
      project.hash.project.objects['PBXBuildFile'][buildFileUuid] = {
        isa: 'PBXBuildFile',
        fileRef: file.fileRef,
        //comment: `${fileName} in Sources`,
      };

      (sourcesBuildPhase as any).files.push({
        value: buildFileUuid,
        comment: `${fileName} in Sources`,
      });

      console.log(`✅ Fichier ajouté : ${fileName}`);
    }

    // Swift config
    const targetUuid = project.getFirstTarget().uuid;

    project.addBuildProperty(
      'SWIFT_OBJC_BRIDGING_HEADER',
      `${iosProjectName}/${BRIDGING_HEADER}`,
      `${BRIDGING_HEADER}`,
      targetUuid
    );

    project.addBuildProperty('SWIFT_VERSION', '5.0', targetUuid);

    return config;
  });
};

export default withNativeFilesPlugin;

