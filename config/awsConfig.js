// src/config/awsConfig.js
import { S3Client } from '@aws-sdk/client-s3'
import config from '../config/config.js'

const s3 = new S3Client({
  region: config.AWS_CONFIG.REGION,
  credentials: {
    accessKeyId: config.AWS_CONFIG.ACCESS_KEY_ID,
    secretAccessKey: config.AWS_CONFIG.SECRET_ACCESS_KEY,
  },
})

export default s3
