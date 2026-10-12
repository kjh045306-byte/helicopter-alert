const { initializeApp, applicationDefault } = require('firebase-admin/app')
const { getAuth } = require('firebase-admin/auth')

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error('GOOGLE_APPLICATION_CREDENTIALS 환경변수에 서비스 계정 키 경로를 지정하세요.')
  process.exit(1)
}
initializeApp({ credential: applicationDefault() })

const ROLE_BY_EMAIL = {
  'kjh045306@gmail.com': 'admin',
  'cds0440@sk.com':      'pilot',
  'jjk@sk.com':          'pilot',
  'juhwan_kim@sk.com':   'pilot',
  's76choi@sk.com':      'crew',
  'hbkim@sk.com':        'crew',
  'moonseop.kim@sk.com': 'crew',
}

;(async () => {
  const auth = getAuth()
  let failed = 0
  for (const [email, role] of Object.entries(ROLE_BY_EMAIL)) {
    try {
      const user = await auth.getUserByEmail(email)
      await auth.setCustomUserClaims(user.uid, { role })
      const check = await auth.getUser(user.uid)
      console.log(`OK   ${email} -> ${JSON.stringify(check.customClaims)}`)
    } catch (e) {
      failed++
      console.error(`FAIL ${email}: ${e.code ?? e.message}`)
    }
  }
  process.exit(failed ? 1 : 0)
})()
