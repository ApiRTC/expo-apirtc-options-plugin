import { ConfigPlugin, withPlugins } from '@expo/config-plugins';
import withAndroidPlugin from './withAndroidPlugin';
import withIosBroadcastExtension from './withIosBroadcastExtension';
import withIosRPKFiles from './withIosRPKFiles';

type PluginProps = {
  enableMediaProjectionService?: boolean;
  enableVideoEffects?: boolean;
  appleTeamId?: string;
};

export const withPlugin: ConfigPlugin<PluginProps> = (
  config,
  props = {
    enableMediaProjectionService: true,
    enableVideoEffects: true,
    appleTeamId: process.env.EXPO_APPLE_TEAM_ID || 'APPLE_TEAM_ID_NOT_SET',
  }
) => {
  config = withAndroidPlugin(config, props);
  config = withIosBroadcastExtension(config, props);
  config = withIosRPKFiles(config, props);
  return config;
};

export default withPlugin;
