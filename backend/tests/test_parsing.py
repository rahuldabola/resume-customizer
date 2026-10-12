import pytest

from app.parsing import ResumeFileError, detect_kind, extract_resume_text


def test_extracts_pdf_text(sample_pdf):
    result = extract_resume_text("resume.pdf", sample_pdf)
    assert result.pages == 1
    assert "Aarav Mehta" in result.text
    assert "Brightpath Technologies" in result.text


def test_extracts_docx_paragraphs_lists_and_tables(sample_docx):
    result = extract_resume_text("resume.docx", sample_docx)
    assert "Priya Sharma" in result.text
    assert "- Built payment APIs" in result.text
    assert "Skills | Python, Django, PostgreSQL" in result.text


@pytest.mark.parametrize(
    ("name", "data", "message"),
    [
        ("resume.txt", b"hello", "Unsupported file type"),
        ("resume.doc", b"\xd0\xcf", ".doc files are not supported"),
        ("resume.pdf", b"PK\x03\x04 not a pdf", "not a valid PDF"),
        ("resume.docx", b"%PDF-1.4", "not a valid Word document"),
    ],
)
def test_rejects_bad_files(name, data, message):
    with pytest.raises(ResumeFileError, match=message):
        detect_kind(name, data)


def test_corrupted_pdf_has_friendly_error():
    with pytest.raises(ResumeFileError, match="Could not read this PDF"):
        extract_resume_text("resume.pdf", b"%PDF-1.4 garbage")
