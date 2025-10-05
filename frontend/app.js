const API_BASE_URL = window.ENV?.API_BASE_URL;

function showLoading() {
    document.getElementById('loadingSpinner').style.display = 'block';
}

function hideLoading() {
    document.getElementById('loadingSpinner').style.display = 'none';
}

function showAlert(message, type = 'info') {
    const alertContainer = document.getElementById('alertContainer');
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    alertContainer.appendChild(alertDiv);

    setTimeout(() => {
        alertDiv.remove();
    }, 5000);
}

function previewImage(input, previewContainer) {
    previewContainer.innerHTML = '';

    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function (e) {
            const img = document.createElement('img');
            img.src = e.target.result;
            img.className = 'photo-preview';
            previewContainer.appendChild(img);
        };
        reader.readAsDataURL(input.files[0]);
    }
}

document.getElementById('userPhoto').addEventListener('change', function () {
    previewImage(this, document.getElementById('photoPreview'));
});

document.getElementById('editUserPhoto').addEventListener('change', function () {
    previewImage(this, document.getElementById('editPhotoPreview'));
});

async function loadUsers() {
    showLoading();
    try {
        const response = await fetch(API_BASE_URL);
        const data = await response.json();

        if (response.ok) {
            displayUsers(data.data || []);
            showAlert(`${data.total || 0} users berhasil dimuat`, 'success');
        } else {
            showAlert(data.error || 'Gagal memuat data users', 'danger');
        }
    } catch (error) {
        console.error('Error:', error);
        showAlert('Tidak dapat terhubung ke server', 'danger');
    } finally {
        hideLoading();
    }
}

function displayUsers(users) {
    const container = document.getElementById('usersContainer');

    if (users.length === 0) {
        container.innerHTML = `
            <div class="col-12 text-center">
                <p class="text-muted">Tidak ada data users</p>
            </div>
        `;
        return;
    }

    container.innerHTML = users.map(user => `
        <div class="col-md-4 mb-3">
            <div class="card user-card">
                <div class="card-body text-center">
                    ${user.foto_url ?
            `<img src="${user.foto_url}" alt="Foto ${user.nama}" class="user-photo">` :
            '<div class="user-photo d-flex align-items-center justify-content-center bg-light"><i class="fas fa-user fa-3x text-muted"></i></div>'
        }
                    <h5 class="card-title">${user.nama}</h5>
                    <p class="card-text text-muted">ID: ${user.id}</p>
                    <div class="d-flex gap-2 justify-content-center">
                        <button class="btn btn-sm btn-warning" onclick="editUser(${user.id}, '${user.nama}', '${user.foto_url || ''}')">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="deleteUser(${user.id}, '${user.nama}')">
                            <i class="fas fa-trash"></i> Hapus
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

document.getElementById('addUserForm').addEventListener('submit', async function (e) {
    e.preventDefault();

    const nama = document.getElementById('userName').value.trim();
    const foto = document.getElementById('userPhoto').files[0];

    if (!nama) {
        showAlert('Nama harus diisi', 'warning');
        return;
    }

    showLoading();
    try {
        const formData = new FormData();
        formData.append('nama', nama);
        if (foto) {
            formData.append('foto', foto);
        }

        const response = await fetch(API_BASE_URL, {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (response.ok) {
            showAlert(`User "${data.data.nama}" berhasil ditambahkan`, 'success');
            document.getElementById('addUserForm').reset();
            document.getElementById('photoPreview').innerHTML = '';
            loadUsers();
        } else {
            showAlert(data.error || 'Gagal menambahkan user', 'danger');
        }
    } catch (error) {
        console.error('Error:', error);
        showAlert('Tidak dapat terhubung ke server', 'danger');
    } finally {
        hideLoading();
    }
});

function editUser(id, nama, fotoUrl) {
    document.getElementById('editUserId').value = id;
    document.getElementById('editUserName').value = nama;

    const editPhotoPreview = document.getElementById('editPhotoPreview');
    editPhotoPreview.innerHTML = '';

    if (fotoUrl && fotoUrl !== 'null') {
        const img = document.createElement('img');
        img.src = fotoUrl;
        img.className = 'photo-preview';
        editPhotoPreview.appendChild(img);
    }

    new bootstrap.Modal(document.getElementById('editModal')).show();
}

async function updateUser() {
    const id = document.getElementById('editUserId').value;
    const nama = document.getElementById('editUserName').value.trim();
    const foto = document.getElementById('editUserPhoto').files[0];

    if (!nama) {
        showAlert('Nama harus diisi', 'warning');
        return;
    }

    showLoading();
    try {
        const formData = new FormData();
        formData.append('nama', nama);
        if (foto) {
            formData.append('foto', foto);
        }

        const response = await fetch(`${API_BASE_URL}?id=${id}`, {
            method: 'PUT',
            body: formData
        });

        const data = await response.json();

        if (response.ok) {
            showAlert(`User berhasil diupdate menjadi "${data.data.nama}"`, 'success');
            bootstrap.Modal.getInstance(document.getElementById('editModal')).hide();
            loadUsers();
        } else {
            showAlert(data.error || 'Gagal mengupdate user', 'danger');
        }
    } catch (error) {
        console.error('Error:', error);
        showAlert('Tidak dapat terhubung ke server', 'danger');
    } finally {
        hideLoading();
    }
}

async function deleteUser(id, nama) {
    if (!confirm(`Yakin ingin menghapus user "${nama}"?`)) {
        return;
    }

    showLoading();
    try {
        const response = await fetch(`${API_BASE_URL}?id=${id}`, {
            method: 'DELETE'
        });

        const data = await response.json();

        if (response.ok) {
            showAlert(`User "${nama}" berhasil dihapus`, 'success');
            loadUsers();
        } else {
            showAlert(data.error || 'Gagal menghapus user', 'danger');
        }
    } catch (error) {
        console.error('Error:', error);
        showAlert('Tidak dapat terhubung ke server', 'danger');
    } finally {
        hideLoading();
    }
}

document.addEventListener('DOMContentLoaded', function () {
    loadUsers();
});