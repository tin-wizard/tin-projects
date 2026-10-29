//
// Copyright © 2024 Hardcore Engineering Inc.
//
// Licensed under the Eclipse Public License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License. You may
// obtain a copy of the License at https://www.eclipse.org/legal/epl-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//
// See the License for the specific language governing permissions and
// limitations under the License.
//

const exec = require('child_process').exec
const fs = require('fs')
const path = require('path')

exec('git describe --tags --abbrev=0', (err, stdout, stderr) => {
  const rawVersion = err === null ? stdout.trim().replace('v', '').replace('s', '').split('.') : []
  if (rawVersion.length === 3) {
    const version = {
      major: parseInt(rawVersion[0]),
      minor: parseInt(rawVersion[1]),
      patch: parseInt(rawVersion[2])
    }
    console.log(`"${version.major}.${version.minor}.${version.patch}"`)
    return
  }
  // No tag, or one that is not vX.Y.Z (e.g. tin/* release tags): use version.txt like show_version.js,
  // so every image of one build reports the same version and front/server version checks agree.
  try {
    console.log(fs.readFileSync(path.resolve(__dirname, 'version.txt'), 'utf8').trim())
  } catch (error) {
    console.log('"0.6.0"')
  }
})
