const fs = require('fs')  
const path = require('path')  
const axios = require('axios')

class localDownload {
    constructor(user, password, host) {
    }

    setDir(downloadDir) {
      this.downloadDir = downloadDir
    }

    addDownload(link, name=null) {
      if (name === null)
        name = link.substring(link.lastIndexOf('/') + 1)
      this.download(link, name)
    }

    async download(url, name) {
      const writer = fs.createWriteStream(path.resolve(this.downloadDir, 'temp', name))
    
      const response = await axios({
        url,
        method: 'GET',
        responseType: 'stream'
      })
      response.data.pipe(writer)
    
      return new Promise((resolve, reject) => {
        writer.on('finish', resolve)
        writer.on('error', reject)
      })
    }
}

exports.localDownload = localDownload