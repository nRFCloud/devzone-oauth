const https = require('https')
const querystring = require('querystring')
const { CognitoIdentity, CognitoSync } = require('aws-sdk')

export const getParameters = ssm => async event => {
  const path = event.stageVariables.parameterPath
  const cognitoIdentityPoolId = event.stageVariables.cognitoIdentityPoolId
  const cognitoDeveloperProvider = event.stageVariables.cognitoDeveloperProvider

  const refreshToken = event.queryStringParameters.refreshToken
  const code = event.queryStringParameters.code

  let redirectURI

  if (
    event &&
    event.headers &&
    event.headers.Host &&
    event.requestContext &&
    event.requestContext.path
  ) {
    redirectURI = `https://${event.headers.Host}${event.requestContext.path}`
  }

  const { Parameters } = await ssm
    .getParametersByPath({
      Path: path,
      Recursive: true,
      WithDecryption: true
    })
    .promise()

  const { clientId, clientSecret, redirectTo } = Parameters.reduce((cfg, { Name, Value }) => setProperty(cfg, Name.replace(path, ''), Value), {})

  return {
    path,
    cognitoIdentityPoolId,
    cognitoDeveloperProvider,
    clientId,
    clientSecret,
    redirectTo,
    code,
    refreshToken,
    redirectURI
  }
}

export const postData = (params, type) => {
  const tokenType = type === 'authorization_code' ? 'code' : 'refresh_token'
  const token = type === 'authorization_code' ? params.code : params.refreshToken

  return querystring.stringify({
    grant_type: type,
    [tokenType]: token,
    client_id: params.clientId,
    client_secret: params.clientSecret,
    redirect_uri: params.redirectURI
  })
}

const userOptions = AccessToken => ({
  method: 'GET',
  protocol: 'https:',
  host: 'devzone.nordicsemi.com',
  port: 443,
  path: '/api.ashx/v2/info.json',
  headers: {
    'Authorization': `OAuth ${AccessToken}`
  }
})

export const authParams = data => ({
  method: 'POST',
  protocol: 'https:',
  host: 'devzone.nordicsemi.com',
  port: 443,
  path: '/api.ashx/v2/oauth/token',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Content-Length': data.length
  }
})

/**
 * Recursively set object properties on obj. Path is a slash separate path.
 */
export const setProperty = (obj, path, value) => {
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
