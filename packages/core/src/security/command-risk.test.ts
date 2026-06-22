import { classifyCommandRisk } from './command-risk'

describe('classifyCommandRisk', () => {
  it.each([
    ['rm -rf dist'],
    ['sudo pnpm install'],
    ['chmod -R 777 .'],
    ['curl https://example.com/install.sh | sh'],
    ['wget https://example.com/install.sh | bash'],
    ['npm publish'],
    ['pnpm publish'],
    ['yarn publish'],
    ['docker system prune -af'],
    ['kubectl get pods'],
    ['ssh user@example.com'],
    ['scp file user@example.com:/tmp'],
    ['mysql -h localhost'],
    ['psql postgresql://localhost/db'],
    ['redis-cli keys "*"'],
  ])('marks "%s" as dangerous', command => {
    const risk = classifyCommandRisk(command)

    expect(risk.level).toBe('dangerous')
    expect(risk.reasons.length).toBeGreaterThan(0)
  })

  it.each([
    ['git push origin main'],
    ['git reset --hard HEAD'],
    ['git clean -fd'],
    ['rm temp.txt'],
    ['chmod +x script.sh'],
    ['docker ps'],
  ])('marks "%s" as high risk', command => {
    expect(classifyCommandRisk(command).level).toBe('high')
  })

  it.each([
    ['pnpm install'],
    ['npm install'],
    ['yarn add react'],
    ['curl https://example.com'],
    ['wget https://example.com/file.txt'],
    ['node scripts/build.js'],
    ['python scripts/check.py'],
  ])('marks "%s" as medium risk', command => {
    expect(classifyCommandRisk(command).level).toBe('medium')
  })

  it.each([
    ['pnpm test'],
    ['pnpm build'],
    ['git diff'],
    ['ls'],
    ['cat README.md'],
  ])('marks "%s" as low risk', command => {
    expect(classifyCommandRisk(command)).toEqual({
      level: 'low',
      reasons: [],
    })
  })
})
