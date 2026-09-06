# R11.2 Production Authorization

User explicitly authorized one new Production deployment for R11.2 after the native OAuth redirect fix is code-complete and CI-green.

Deployment safety remains unchanged:

- one authorization = one Production deployment
- Git auto-deployment stays disabled by default
- after the authorized deployment starts, do not send a second trigger commit
- restore `vercel.json` to `deploymentEnabled: false` after the deployment is READY
