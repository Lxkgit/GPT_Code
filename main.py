import os
import sys
from dataclasses import dataclass
from pathlib import Path

from PyQt6 import QtCore, QtGui, QtWidgets


@dataclass
class SmbShare:
    name: str
    path: Path


def parse_smb_conf(conf_path: Path) -> list[SmbShare]:
    shares: list[SmbShare] = []
    if not conf_path.exists():
        return shares

    current_section = None
    current_path = None

    for raw_line in conf_path.read_text(encoding="utf-8", errors="ignore").splitlines():
        line = raw_line.strip()
        if not line or line.startswith(('#', ';')):
            continue
        if line.startswith('[') and line.endswith(']'):
            if current_section and current_path:
                shares.append(SmbShare(current_section, current_path))
            current_section = line[1:-1].strip()
            current_path = None
            continue
        if '=' in line and current_section:
            key, value = [part.strip() for part in line.split('=', 1)]
            if key.lower() == 'path':
                current_path = Path(value).expanduser()

    if current_section and current_path:
        shares.append(SmbShare(current_section, current_path))

    return shares


class SmbBrowserCard(QtWidgets.QFrame):
    def __init__(self, parent: QtWidgets.QWidget | None = None) -> None:
        super().__init__(parent)
        self.setFrameShape(QtWidgets.QFrame.Shape.StyledPanel)
        self.setFrameShadow(QtWidgets.QFrame.Shadow.Raised)

        self.conf_path_edit = QtWidgets.QLineEdit("/etc/samba/smb.conf")
        self.conf_browse_button = QtWidgets.QPushButton("选择配置文件")
        self.refresh_button = QtWidgets.QPushButton("刷新共享")

        self.share_list = QtWidgets.QListWidget()
        self.file_list = QtWidgets.QListWidget()

        self.status_label = QtWidgets.QLabel("请选择共享目录")
        self.status_label.setStyleSheet("color: #555;")

        header_layout = QtWidgets.QHBoxLayout()
        header_layout.addWidget(QtWidgets.QLabel("SMB 配置文件:"))
        header_layout.addWidget(self.conf_path_edit, stretch=1)
        header_layout.addWidget(self.conf_browse_button)
        header_layout.addWidget(self.refresh_button)

        splitter = QtWidgets.QSplitter(QtCore.Qt.Orientation.Horizontal)
        splitter.addWidget(self.share_list)
        splitter.addWidget(self.file_list)
        splitter.setStretchFactor(0, 1)
        splitter.setStretchFactor(1, 2)

        layout = QtWidgets.QVBoxLayout(self)
        layout.addLayout(header_layout)
        layout.addWidget(splitter, stretch=1)
        layout.addWidget(self.status_label)

        self.conf_browse_button.clicked.connect(self.choose_conf)
        self.refresh_button.clicked.connect(self.load_shares)
        self.share_list.itemSelectionChanged.connect(self.load_files)
        self.file_list.itemDoubleClicked.connect(self.open_selected_file)

        self.load_shares()

    def choose_conf(self) -> None:
        path, _ = QtWidgets.QFileDialog.getOpenFileName(
            self, "选择 smb.conf", str(Path.home()), "smb.conf (smb.conf);;All Files (*)"
        )
        if path:
            self.conf_path_edit.setText(path)
            self.load_shares()

    def load_shares(self) -> None:
        self.share_list.clear()
        self.file_list.clear()

        conf_path = Path(self.conf_path_edit.text()).expanduser()
        shares = parse_smb_conf(conf_path)
        if not shares:
            self.status_label.setText("未找到共享目录，请检查配置文件路径。")
            return

        for share in shares:
            item = QtWidgets.QListWidgetItem(f"{share.name}  ({share.path})")
            item.setData(QtCore.Qt.ItemDataRole.UserRole, share)
            self.share_list.addItem(item)

        self.status_label.setText("请选择共享目录")

    def load_files(self) -> None:
        self.file_list.clear()
        selected_items = self.share_list.selectedItems()
        if not selected_items:
            return

        share: SmbShare = selected_items[0].data(QtCore.Qt.ItemDataRole.UserRole)
        if not share.path.exists():
            self.status_label.setText(f"目录不存在: {share.path}")
            return

        entries = sorted(share.path.iterdir(), key=lambda p: (p.is_file(), p.name.lower()))
        for entry in entries:
            label = entry.name + ("/" if entry.is_dir() else "")
            item = QtWidgets.QListWidgetItem(label)
            item.setData(QtCore.Qt.ItemDataRole.UserRole, entry)
            self.file_list.addItem(item)

        self.status_label.setText(f"{share.name} 下共有 {len(entries)} 个项目")

    def open_selected_file(self, item: QtWidgets.QListWidgetItem) -> None:
        entry: Path = item.data(QtCore.Qt.ItemDataRole.UserRole)
        if entry.is_dir():
            self.file_list.clear()
            entries = sorted(entry.iterdir(), key=lambda p: (p.is_file(), p.name.lower()))
            for child in entries:
                label = child.name + ("/" if child.is_dir() else "")
                child_item = QtWidgets.QListWidgetItem(label)
                child_item.setData(QtCore.Qt.ItemDataRole.UserRole, child)
                self.file_list.addItem(child_item)
            self.status_label.setText(f"进入目录: {entry}")
            return

        url = QtCore.QUrl.fromLocalFile(str(entry))
        if not QtGui.QDesktopServices.openUrl(url):
            QtWidgets.QMessageBox.warning(self, "打开失败", "无法使用系统默认程序打开该文件。")


class CardContainer(QtWidgets.QWidget):
    def __init__(self) -> None:
        super().__init__()
        layout = QtWidgets.QVBoxLayout(self)
        layout.setSpacing(12)
        layout.addStretch()

    def add_card(self, card: QtWidgets.QWidget) -> None:
        layout: QtWidgets.QVBoxLayout = self.layout()
        layout.insertWidget(layout.count() - 1, card)


class MainWindow(QtWidgets.QMainWindow):
    def __init__(self) -> None:
        super().__init__()
        self.setWindowTitle("功能卡片管理器")
        self.resize(1000, 700)

        self.card_container = CardContainer()
        scroll = QtWidgets.QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setWidget(self.card_container)

        add_card_button = QtWidgets.QPushButton("添加 SMB 浏览卡片")
        add_card_button.clicked.connect(self.add_smb_card)

        top_bar = QtWidgets.QHBoxLayout()
        top_bar.addWidget(QtWidgets.QLabel("功能卡片"))
        top_bar.addStretch()
        top_bar.addWidget(add_card_button)

        central = QtWidgets.QWidget()
        layout = QtWidgets.QVBoxLayout(central)
        layout.addLayout(top_bar)
        layout.addWidget(scroll, stretch=1)
        self.setCentralWidget(central)

        self.add_smb_card()

    def add_smb_card(self) -> None:
        self.card_container.add_card(SmbBrowserCard())


def main() -> None:
    app = QtWidgets.QApplication(sys.argv)
    window = MainWindow()
    window.show()
    sys.exit(app.exec())


if __name__ == "__main__":
    main()
