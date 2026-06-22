import { isSensitivePath } from './sensitive-files'

describe('isSensitivePath', () => {
  it.each([
    '.env',
    '.env.local',
    'apps/web/.env.production',
    'id_rsa',
    'id_ed25519',
    'cert.pem',
    'private.key',
    'server.crt',
    '.ssh/config',
    'home/user/.aws/credentials',
    '.kube/config',
    '.git/config',
  ])('marks %s as sensitive', targetPath => {
    expect(isSensitivePath(targetPath)).toBe(true)
  })

  it.each([
    'README.md',
    'src/index.ts',
    'package.json',
    'docs/security.md',
    'env.example',
    'src/key-value.ts',
  ])('does not mark %s as sensitive', targetPath => {
    expect(isSensitivePath(targetPath)).toBe(false)
  })
})
