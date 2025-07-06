import { register, loadConfig } from 'tsconfig-paths';

// 加载 tsconfig.json 并处理注释
const tsConfig = loadConfig();

if (tsConfig.resultType === 'success') {
  const baseUrl = tsConfig.absoluteBaseUrl;
  const paths = tsConfig.paths;

  // 注册别名
  register({
    baseUrl,
    paths,
  });
} else {
  console.error('Failed to load tsconfig.json:', tsConfig.message);
}
