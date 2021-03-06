'use strict'

const https = require('https')
const querystring = require('querystring')
const { SSM, CognitoIdentity, CognitoSync } = require('aws-sdk')
const { setProperty } = require('common')

const ssm = new SSM()

exports.handler = async (event) => {
  const path = event.stageVariables.parameterPath
  const cognitoIdentityPoolId = event.stageVariables.cognitoIdentityPoolId
  const cognitoDeveloperProvider = event.stageVariables.cognitoDeveloperProvider
  const { Parameters } = await ssm
    .getParametersByPath({
      Path: path,
      Recursive: true,
      WithDecryption: true
    })
    .promise()
  const { clientId, clientSecret, redirectTo } = Parameters.reduce((cfg, { Name, Value }) => setProperty(cfg, Name.replace(path, ''), Value), {})

  const postData = querystring.stringify({
    grant_type: 'authorization_code',
    code: event.queryStringParameters.code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: `https://${event.headers.Host}${event.requestContext.path}`
  })

  return new Promise(resolve => {
    // Get access token
    const req = https
      .request({
        method: 'POST',
        protocol: 'https:',
        host: 'devzone.nordicsemi.com',
        port: 443,
        path: '/api.ashx/v2/oauth/token',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': postData.length
        }
      }, res => {
        res.setEncoding('utf8')
        const body = []
        res.on('data', data => {
          body.push(data)
        })
        res.on('end', () => {
          const { access_token: AccessToken, refresh_token: RefreshToken } = JSON.parse(body.join(''))

          https.get({
            protocol: 'https:',
            host: 'devzone.nordicsemi.com',
            port: 443,
            path: '/api.ashx/v2/info.json',
            headers: {
              'Authorization': `OAuth ${AccessToken}`
            }
          }, res => {
            res.setEncoding('utf8')
            const body = []
            res.on('data', data => {
              body.push(data)
            })
            res.on('end', () => {
              const { Username, DisplayName, AvatarUrl, PrivateEmail } = JSON.parse(body.join('')).AccessingUser
              const identityClient = new CognitoIdentity()
              identityClient
                .getOpenIdTokenForDeveloperIdentity({
                  IdentityPoolId: cognitoIdentityPoolId,
                  Logins: {
                    [cognitoDeveloperProvider]: `${Username}@devzone`
                  },
                  TokenDuration: 86400 // Token lifetime 24hrs
                })
                .promise()
                .then(({ IdentityId, Token }) => {
                  const cognitosync = new CognitoSync()
                  return cognitosync
                    .listRecords({
                      DatasetName: 'identityInfo',
                      IdentityId,
                      IdentityPoolId: cognitoIdentityPoolId
                    })
                    .promise()
                    .then((res) => {
                      const { SyncSessionToken, Records } = res
                      return cognitosync
                        .updateRecords({
                          DatasetName: 'identityInfo',
                          IdentityId,
                          IdentityPoolId: cognitoIdentityPoolId,
                          SyncSessionToken,
                          ClientContext: 'oauth-login',
                          RecordPatches: [{
                            Key: 'email',
                            Op: 'replace',
                            SyncCount: (Records.find(({ Key }) => Key === 'email') || {}).SyncCount || 0,
                            Value: PrivateEmail
                          }, {
                            Key: 'name',
                            Op: 'replace',
                            SyncCount: (Records.find(({ Key }) => Key === 'name') || {}).SyncCount || 0,
                            Value: DisplayName
                          }, {
                            Key: 'avatar',
                            Op: 'replace',
                            SyncCount: (Records.find(({ Key }) => Key === 'avatar') || {}).SyncCount || 0,
                            Value: AvatarUrl
                          }, {
                            Key: 'refresh_token',
                            Op: 'replace',
                            SyncCount: (Records.find(({ Key }) => Key === 'refresh_token') || {}).SyncCount || 0,
                            Value: RefreshToken
                          }]
                        })
                        .promise()
                        .then(() => resolve({
                          statusCode: 303,
                          headers: {
                            'Location': redirectTo.replace('${token}', Token).replace('${refreshToken}', RefreshToken) // eslint-disable-line no-template-curly-in-string
                          }
                        }))
                    })
                })
                .catch(err => resolve({
                  statusCode: 500,
                  headers: {
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify(err)
                }))
            })
          })
        })
      })
    req.on('error', err => resolve({
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(err)
    }))
    req.write(postData)
    req.end()
  })
}
