/** MOYU Kernel Release Signing Key（Ed25519 公钥）。私钥不进入仓库或应用产物。 */
export const MOYU_KERNEL_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEA8FYr2N1g3QSAE3yUah4oXfo+yTa857OKrG1s4WUkkHg=
-----END PUBLIC KEY-----`

/** 首版内核清单使用 GitHub Releases 固定标签；清单只用于发现，安装仍须验签与验哈希。 */
export const MOYU_KERNEL_FEEDS = Object.freeze({
  stable: 'https://github.com/Clukay-Fun/moyu-dsh/releases/download/kernel-stable/kernel-manifest.json',
  beta: 'https://github.com/Clukay-Fun/moyu-dsh/releases/download/kernel-beta/kernel-manifest.json',
})
