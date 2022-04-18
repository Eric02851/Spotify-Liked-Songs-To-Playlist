var express = require('express')
var request = require('request')
var cors = require('cors')
var querystring = require('querystring')
var cookieParser = require('cookie-parser')
const axios = require('axios')
require('dotenv').config({ path: '/Users/eric/Documents/GitHub/Spotify-Liked-Songs-To-Playlist/tokens.env' })

var client_id = process.env.CLIENT_ID
var client_secret = process.env.CLIENT_SECRET
var redirect_uri = 'http://localhost:8888/callback'

/**
 * Generates a random string containing numbers and letters
 * @param  {number} length The length of the string
 * @return {string} The generated string
 */

var generateRandomString = function (length) {
    var text = ''
    var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

    for (var i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length))
    }
    return text
}

var stateKey = 'spotify_auth_state'

var app = express()

app.use(express.static(__dirname + '/public'))
    .use(cors())
    .use(cookieParser())

app.get('/login', function (req, res) {

    var state = generateRandomString(16)
    res.cookie(stateKey, state)

    // your application requests authorization
    var scope = 'user-library-read playlist-modify-public'
    res.redirect('https://accounts.spotify.com/authorize?' +
        querystring.stringify({
            response_type: 'code',
            client_id: client_id,
            scope: scope,
            redirect_uri: redirect_uri,
            state: state
        }))
})

const test = async (access_token) => {
    let tracks = []

    let options = {
        url: 'https://api.spotify.com/v1/me/tracks?offset=0&limit=50',
        headers: { 'Authorization': 'Bearer ' + access_token },
        json: true
    }

    let res = await axios.get('https://api.spotify.com/v1/me/tracks?offset=0&limit=50',{ headers: { Authorization: 'Bearer ' + access_token } })
    console.log(res.status)
    console.log(res.data.items.length)
    console.log()

    for (i in res.data.items) { tracks.push(res.data.items[i]) }

    while (res.data.items.length == 50) {
        res = await axios.get(`https://api.spotify.com/v1/me/tracks?offset=${tracks.length}&limit=50`,{headers: {Authorization: 'Bearer ' + access_token}})
        console.log(res.status)
        console.log(res.data.items.length)
        console.log()

        if (res.data.items.length == 0) {

        }

        for (i in res.data.items) { tracks.push(res.data.items[i]) }
    }


    console.log(tracks.length)
}

app.get('/callback', function (req, res) {

    // your application requests refresh and access tokens
    // after checking the state parameter

    var code = req.query.code || null
    var state = req.query.state || null
    var storedState = req.cookies ? req.cookies[stateKey] : null

    if (state === null || state !== storedState) {
        res.redirect('/#' +
            querystring.stringify({
                error: 'state_mismatch'
            }))
    } else {
        res.clearCookie(stateKey)
        var authOptions = {
            url: 'https://accounts.spotify.com/api/token',
            form: {
                code: code,
                redirect_uri: redirect_uri,
                grant_type: 'authorization_code'
            },
            headers: {
                'Authorization': 'Basic ' + (new Buffer(client_id + ':' + client_secret).toString('base64'))
            },
            json: true
        }

        request.post(authOptions, function (error, response, body) {
            if (!error && response.statusCode === 200) {

                var access_token = body.access_token,
                    refresh_token = body.refresh_token

                test(access_token)

                var options = {
                    url: 'https://api.spotify.com/v1/me',
                    headers: { 'Authorization': 'Bearer ' + access_token },
                    json: true
                }

                // use the access token to access the Spotify Web API
                request.get(options, function (error, response, body) {
                    console.log(body)
                })

                // we can also pass the token to the browser to make requests from there
                res.redirect('/#' +
                    querystring.stringify({
                        access_token: access_token,
                        refresh_token: refresh_token
                    }))
            } else {
                res.redirect('/#' +
                    querystring.stringify({
                        error: 'invalid_token'
                    }))
            }
        })
    }
})

app.get('/refresh_token', function (req, res) {
    // requesting access token from refresh token
    var refresh_token = req.query.refresh_token
    var authOptions = {
        url: 'https://accounts.spotify.com/api/token',
        headers: { 'Authorization': 'Basic ' + (new Buffer(client_id + ':' + client_secret).toString('base64')) },
        form: {
            grant_type: 'refresh_token',
            refresh_token: refresh_token
        },
        json: true
    }

    request.post(authOptions, function (error, response, body) {
        if (!error && response.statusCode === 200) {
            var access_token = body.access_token
            res.send({
                'access_token': access_token
            })
        }
    })
})

app.get('/savedTracks', function (req, res) {
    access_token = "Ks3Gbdy4dgaVRYOEi9hpWeROSPgwRPEg1PkK4ZUZnhlQ4jSDS1eFW6wQaJiP1xBq89flOg8CpqM8xmqqnxRLraB6a8_8gRNptq88ZevohoMMASlPZ_Dad5ZxO7n0SjOKgoVpLPuJpPRn7pPDhc7DuwMF2L9yznm2wFhKSsHXo3whuoPk0DazbYBjWiT0SzbUnSnfmLcfut3_OVshOYFOHKLrSj0"

    var options = {
        url: 'https://api.spotify.com/v1/me',
        headers: { 'Authorization': 'Bearer ' + access_token },
        json: true
    }

    // use the access token to access the Spotify Web API
    request.get(options, function (error, response, body) {
        console.log(body)
    })
})

console.log('Listening on 8888')
app.listen(8888)