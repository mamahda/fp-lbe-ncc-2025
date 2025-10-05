const { app } = require('@azure/functions');
const { Pool } = require('pg');
const { BlobServiceClient } = require('@azure/storage-blob');

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  ssl: {
    rejectUnauthorized: false
  }
});

const blobServiceClient = BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING);
const containerName = process.env.BLOB_CONTAINER_NAME;

async function uploadToBlob(buffer, fileName, mimeType) {
  try {
    const containerClient = blobServiceClient.getContainerClient(containerName);

    await containerClient.createIfNotExists({
      access: 'blob'
    });

    const blobName = `${Date.now()}-${fileName}`;
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    await blockBlobClient.upload(buffer, buffer.length, {
      blobHTTPHeaders: {
        blobContentType: mimeType
      }
    });

    return blockBlobClient.url;
  } catch (error) {
    throw new Error(`Blob upload failed: ${error.message}`);
  }
}

async function deleteFromBlob(blobUrl) {
  try {
    if (!blobUrl) return;

    const containerClient = blobServiceClient.getContainerClient(containerName);
    const blobName = blobUrl.split('/').pop();
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    await blockBlobClient.deleteIfExists();
  } catch (error) {
    console.error('Error deleting blob:', error);
  }
}

app.http('httpTrigger1', {
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    context.log(`Http function processed request for url "${request.url}"`);

    try {
      const client = await pool.connect();
      const method = request.method;

      if (method === 'GET') {
        const userId = request.query.get('id');

        if (userId) {
          const result = await client.query('SELECT id, nama, foto_url FROM users WHERE id = $1', [userId]);
          client.release();


          if (result.rows.length === 0) {
            // TODO: Handle return jika user tidak ditemukan dengan pesan error
            return {
              status: 404,
              body: JSON.stringify({ error: 'User not found' })
            }
          }

          // TODO: Return data user berdasarkan ID dengan message success
          return {
            status: 200,
            body: JSON.stringify({ message: 'success', data: result.rows[0] })
          }
        } else {
          const result = await client.query('SELECT id, nama, foto_url FROM users ORDER BY id ASC');
          client.release();

          // TODO: Return semua data user dengan message success dan total data
          return {
            status: 200,
            body: JSON.stringify({ message: 'success', total: result.rows.length, data: result.rows })
          }
        }

      } else if (method === 'POST') {
        const contentType = request.headers.get('content-type') || '';

        if (contentType.includes('multipart/form-data')) {
          const formData = await request.formData();
          const nama = formData.get('nama');
          const fotoFile = formData.get('foto');

          if (!nama) {
            client.release();
            // TODO: Handle return jika nama tidak diisi dengan pesan error
            return {
              status: 400,
              body: JSON.stringify({ error: 'Nama is required' })
            }
          }

          let fotoUrl = null;

          if (fotoFile && fotoFile.size > 0) {
            const buffer = Buffer.from(await fotoFile.arrayBuffer());
            fotoUrl = await uploadToBlob(buffer, fotoFile.name, fotoFile.type);
          }

          const result = await client.query(
            'INSERT INTO users(nama, foto_url) VALUES($1, $2) RETURNING id, nama, foto_url',
            [nama, fotoUrl]
          );
          client.release();

          // TODO: Return data user yang baru ditambahkan dengan message success
          return {
            status: 201,
            body: JSON.stringify({ message: 'success', data: result.rows[0] })
          }

        } else {
          const requestBody = await request.json();
          const { nama } = requestBody;

          if (!nama) {
            client.release();
            // TODO: Handle return jika nama tidak diisi dengan pesan error
            return {
              status: 400,
              body: JSON.stringify({ error: 'Nama is required' })
            }
          }

          const result = await client.query(
            'INSERT INTO users(nama, foto_url) VALUES($1, $2) RETURNING id, nama, foto_url',
            [nama, null]
          );
          client.release();

          // TODO: Return data user yang baru ditambahkan
          return {
            status: 201,
            body: JSON.stringify({ message: 'success', data: result.rows[0] })
          }
        }

      } else if (method === 'PUT') {
        const userId = request.query.get('id');
        const contentType = request.headers.get('content-type') || '';

        if (!userId) {
          client.release();
          // TODO: Handle return jika ID tidak diisi dengan pesan error
          return {
            status: 400,
            body: JSON.stringify({ error: 'User ID is required' })
          }
        }

        const currentUser = await client.query('SELECT foto_url FROM users WHERE id = $1', [userId]);
        if (currentUser.rows.length === 0) {
          client.release();
          // TODO: Handle return jika user tidak ditemukan dengan pesan error
          return {
            status: 404,
            body: JSON.stringify({ error: 'User not found' })
          }
        }

        let nama, fotoUrl = currentUser.rows[0].foto_url;

        if (contentType.includes('multipart/form-data')) {
          const formData = await request.formData();
          nama = formData.get('nama');
          const fotoFile = formData.get('foto');

          if (fotoFile && fotoFile.size > 0) {
            if (fotoUrl) {
              await deleteFromBlob(fotoUrl);
            }

            const buffer = Buffer.from(await fotoFile.arrayBuffer());
            fotoUrl = await uploadToBlob(buffer, fotoFile.name, fotoFile.type);
          }
        } else {
          const requestBody = await request.json();
          nama = requestBody.nama;
        }

        if (!nama) {
          client.release();
          // TODO: Handle return jika nama tidak diisi dengan pesan error
          return {
            status: 400,
            body: JSON.stringify({ error: 'Nama is required' })
          }
        }

        const result = await client.query(
          'UPDATE users SET nama = $1, foto_url = $2 WHERE id = $3 RETURNING id, nama, foto_url',
          [nama, fotoUrl, userId]
        );
        client.release();

        // TODO: Return data user yang telah diperbarui dengan message success
        return {
          status: 200,
          body: JSON.stringify({ message: 'success', data: result.rows[0] })
        }

      } else if (method === 'DELETE') {
        const userId = request.query.get('id');

        if (!userId) {
          client.release();
          // TODO: Handle return jika ID tidak diisi dengan pesan error
          return {
            status: 400,
            body: JSON.stringify({ error: 'User ID is required' })
          }
        }

        const result = await client.query(
          'DELETE FROM users WHERE id = $1 RETURNING id, nama, foto_url',
          [userId]
        );

        if (result.rows.length === 0) {
          client.release();
          // TODO: Handle return jika user tidak ditemukan dengan pesan error
          return {
            status: 404,
            body: JSON.stringify({ error: 'User not found' })
          }
        }

        if (result.rows[0].foto_url) {
          await deleteFromBlob(result.rows[0].foto_url);
        }

        client.release();

        // TODO: Return data user yang telah dihapus dengan message success
        return {
          status: 200,
          body: JSON.stringify({ message: 'success', data: result.rows[0] })
        }
      }

    } catch (error) {
      context.error('Database error:', error);
      return {
        status: 500,
        body: JSON.stringify({
          error: 'Server error',
          details: error.message
        })
      };
    }
  }
});