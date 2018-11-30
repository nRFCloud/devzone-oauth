'use strict'

const https = require('https')
const querystring = require('querystring')
const { SSM, CognitoIdentity, CognitoSync } = require('aws-sdk')

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
  const { clientId, clientSecret } = Parameters.reduce((cfg, { Name, Value }) => setProperty(cfg, Name.replace(path, ''), Value), {})
  // request for new access token
  const postData = querystring.stringify({
    grant_type: 'refresh_token',
    refresh_token: event.queryStringParameters.refreshToken,
    client_id: clientId,
    client_secret: clientSecret
  })

  const refreshResult = await new Promise(resolve => {
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
              const { Username } = JSON.parse(body.join('')).AccessingUser
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
                  cognitosync
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
                          ClientContext: 'oauth-refresh',
                          RecordPatches: [{
                            Key: 'refresh_token',
                            Op: 'replace',
                            SyncCount: (Records.find(({ Key }) => Key === 'refresh_token') || {}).SyncCount || 0,
                            Value: RefreshToken
                          }]
                        })
                        .promise()
                    })
                  resolve({
                    statusCode: 201,
                    headers: {
                      'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                      token: Token,
                      refresh: RefreshToken
                    })
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

  return refreshResult
}

/**
 * Recursively set object properties on obj. Path is a slash separate path.
 */
const setProperty = (obj, path, value) => {
  const s = path.split('/', 2)
  const k = s[0]
  if (s.length === 2) {
    if (!obj[k]) {
      obj[k] = {}
    }
    obj[k] = setProperty(obj[k], s[1], value)
  } else {
    obj[k] = value
  }
  return obj
}
