#!/bin/bash

# --- CẤU HÌNH ---
VPS_IP="103.75.186.186"
VPS_PORT="24700"
VPS_USER="root"
ZIP_NAME="backend.zip"
REMOTE_PATH="/root/"

echo "🚀 Đang chuẩn bị đóng gói mã nguồn..."

# 1. Nén file (loại bỏ node_modules và các file không cần thiết)
zip -r $ZIP_NAME server.js package.json index.html student_data.js logo.png .env Kyluat/ schema.sql migrate_data.js -x "node_modules/*" ".git/*" ".DS_Store"

echo "📦 Đã tạo xong $ZIP_NAME. Đang tải lên VPS..."

# 2. Tải lên VPS bằng SCP
scp -P $VPS_PORT $ZIP_NAME $VPS_USER@$VPS_IP:$REMOTE_PATH

echo "🆙 Đã tải lên thành công. Đang kích hoạt mã mới trên VPS..."

# 3. Kết nối SSH để giải nén và khởi động lại PM2
ssh -p $VPS_PORT $VPS_USER@$VPS_IP << EOF
  cd $REMOTE_PATH
  unzip -o $ZIP_NAME
  npm install --production
  pm2 restart school-web
  echo "✅ Website đã được cập nhật và khởi chạy lại!"
EOF

# 4. Dọn dẹp file zip ở máy local
rm $ZIP_NAME

echo "✨ Hoàn tất! Bạn có thể kiểm tra website tại http://$VPS_IP:3000"
