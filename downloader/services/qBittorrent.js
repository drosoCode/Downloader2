const axios = require('axios');

class qBittorrent {
    constructor(user, password, host) {
        this.endpoint = 'http://' + host + '/api/v2/'
        axios.post(this.endpoint + 'auth/login', {username: user, password: password})
          .then((response) => {
              console.log(response.headers['set-cookie'])
            this.cookie = response.headers['set-cookie']
          })
          .catch(() => {
              console.log('qBittorrent Authentication Failed')
          })
    }

    addDownload(link, name=null) {
        axios.request({
            url: this.endpoint + 'torrents/add',
            method: 'post',
            headers:{
                Cookie: 'SID=' + this.cookie
            },
            data: {
                urls: link
            }
        })
    }
}

exports.qBittorrent = qBittorrent