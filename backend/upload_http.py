"""Multipart helpers for the upload-batch HTTP endpoint."""

from email.parser import BytesParser
from email.policy import default


def parse_multipart_files(content_type, payload):
    """Extract uploaded files named ``files`` without interpreting their content."""
    if not content_type.lower().startswith("multipart/form-data"):
        raise ValueError("Expected multipart/form-data")

    message = BytesParser(policy=default).parsebytes(
        f"Content-Type: {content_type}\r\nMIME-Version: 1.0\r\n\r\n".encode("utf-8") + payload
    )
    if not message.is_multipart():
        raise ValueError("Invalid multipart request")

    files = []
    for part in message.iter_parts():
        if part.get_param("name", header="content-disposition") != "files":
            continue
        filename = part.get_filename()
        if filename is None:
            continue
        files.append((filename, part.get_payload(decode=True) or b""))
    return files
