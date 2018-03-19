# Login with {DevZone

[![npm version](https://img.shields.io/npm/v/@nrfcloud/devzone-oauth.svg)](https://www.npmjs.com/package/@nrfcloud/devzone-oauth)
[![Build Status](https://travis-ci.org/nRFCloud/devzone-oauth.svg?branch=saga)](https://travis-ci.org/nRFCloud/devzone-oauth)
[![Greenkeeper badge](https://badges.greenkeeper.io/nrfcloud/devzone-oauth.svg)](https://greenkeeper.io/)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)
[![Commitizen friendly](https://img.shields.io/badge/commitizen-friendly-brightgreen.svg)](http://commitizen.github.io/cz-cli/)  
[![DeepScan grade](https://deepscan.io/api/projects/2118/branches/10525/badge/grade.svg)](https://deepscan.io/dashboard#view=project&pid=2118&bid=10525)
[![Known Vulnerabilities](https://snyk.io/test/github/nrfcloud/devzone-oauth/badge.svg?targetFile=package.json)](https://snyk.io/test/github/nrfcloud/devzone-oauth?targetFile=package.json)
[![Maintainability](https://api.codeclimate.com/v1/badges/096e1c169b06f283478d/maintainability)](https://codeclimate.com/github/nRFCloud/devzone-oauth/maintainability)

Enables logging in to [nRFCloud.com](https://nrfcloud.com/) with an [Nordic {DevZone](https://devzone.nordicsemi.com/) account.

After sending users to the login URL
```
https://devzone.nordicsemi.com/api.ashx/v2/oauth/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}`
```
the lambda receives and authentication code in the redirect
which it exchanges for an access token (using the client secret).

After that it fetches the user information from {DevZone:
```
Authentication: OAuth ${accessToken}
GET https://devzone.nordicsemi.com/api.ashx/v2/info.json
```

It uses the `AccessingUser.Username` property in the response to 
look up the user in the Cognito UserPool and create a 
Cognito authentication token, which is then forwarded to the frontend
in a redirect.

Some values of the user profile are stored in the `identityInfo`
Cognito Identity dataset.

## Configuration

Expects these configuration settings in the `event.stageVariables` 
(e.g. via [API Gateway stage variables](https://docs.aws.amazon.com/apigateway/latest/developerguide/stage-variables.html)):

| name | description | example |
|------|-------------|---------|
| `clientId` | *DevZone* OAuth client ID | `aba56295-...` |
| `clientSecret` | *DevZone* OAuth client secret | `73c2b6...` |
| `redirectTo` | Redirect to this url with the OpenIdToken | `https://nrfcloud.com/` |
| `cognitoIdentityPoolId` | ID of the Cognito Identity Pool | `us-east-1:c00e1327-...` |
| `cognitoDeveloperProvider` | Name of the custom authenticiation provide of the Identity Pool | `login.nrfcloud.com` |
