"""Generate the fictional sample resume used by the demo button and the tests."""

from pathlib import Path

from fpdf import FPDF

LINES = [
    ("title", "Aarav Mehta"),
    ("center", "Software Engineer"),
    ("center", "aarav.mehta@example.com | +91 98765 43210 | Noida, India | github.com/aaravm"),
    ("h", "PROFILE"),
    ("p", "Software engineer with 2.5 years of experience building web applications. I like working "
          "across frontend and backend and have recently been working with AI features."),
    ("h", "SKILLS"),
    ("p", "Languages: Python, JavaScript, TypeScript, SQL, Java"),
    ("p", "Frameworks: React, Flask, Node.js, Express, Bootstrap"),
    ("p", "Tools: Git, Docker, Postgres, MongoDB, Jira, GitHub Actions, AWS EC2"),
    ("h", "EXPERIENCE"),
    ("b", "Software Engineer - Brightpath Technologies"),
    ("i", "Noida | Jan 2024 - Present"),
    ("li", "Worked on the customer support dashboard used by 40 support agents, built with React and TypeScript."),
    ("li", "Made endpoints in Flask for the mobile team and wrote the Postgres queries behind them."),
    ("li", "Added an OpenAI-based reply suggestion feature that cut average handling time by 18%."),
    ("li", "Set up GitHub Actions to run tests and build Docker images on every pull request."),
    ("li", "Responsible for fixing production bugs reported by customers and writing root-cause notes."),
    ("b", "Software Engineering Intern - Kodex Labs"),
    ("i", "Remote | Jun 2023 - Dec 2023"),
    ("li", "Built an internal inventory tool in Node.js and Express with a MongoDB database."),
    ("li", "Wrote unit tests with Jest that raised coverage from 35% to 70%."),
    ("li", "Helped migrate 12 pages from jQuery to React."),
    ("h", "PROJECTS"),
    ("b", "DocChat - chat with your PDFs"),
    ("i", "Python, Flask, ChromaDB, Gemini API"),
    ("li", "Built a retrieval-augmented chatbot that answers questions over uploaded PDFs with citations."),
    ("li", "Deployed it with Docker on an AWS EC2 instance behind Nginx."),
    ("h", "EDUCATION"),
    ("b", "B.Tech, Computer Science - Galgotias University"),
    ("i", "2019 - 2023 | CGPA 8.1"),
    ("h", "CERTIFICATIONS"),
    ("li", "AWS Certified Cloud Practitioner (2024)"),
]


def build(path: Path) -> None:
    pdf = FPDF(format="A4")
    pdf.add_page()
    pdf.set_margins(18, 15, 18)
    w = pdf.w - 36
    for kind, text in LINES:
        if kind == "title":
            pdf.set_font("Helvetica", "B", 18)
            pdf.cell(w, 9, text, align="C", new_x="LMARGIN", new_y="NEXT")
        elif kind == "center":
            pdf.set_font("Helvetica", "", 10)
            pdf.cell(w, 5, text, align="C", new_x="LMARGIN", new_y="NEXT")
        elif kind == "h":
            pdf.ln(3)
            pdf.set_font("Helvetica", "B", 11)
            pdf.cell(w, 6, text, new_x="LMARGIN", new_y="NEXT")
        elif kind == "b":
            pdf.set_font("Helvetica", "B", 10)
            pdf.cell(w, 5.5, text, new_x="LMARGIN", new_y="NEXT")
        elif kind == "i":
            pdf.set_font("Helvetica", "I", 9.5)
            pdf.cell(w, 5, text, new_x="LMARGIN", new_y="NEXT")
        elif kind == "li":
            pdf.set_font("Helvetica", "", 10)
            pdf.multi_cell(w, 5, "- " + text, new_x="LMARGIN", new_y="NEXT")
        else:
            pdf.set_font("Helvetica", "", 10)
            pdf.multi_cell(w, 5, text, new_x="LMARGIN", new_y="NEXT")
    pdf.output(str(path))


if __name__ == "__main__":
    out = Path(__file__).parent / "sample_resume.pdf"
    build(out)
    print(f"wrote {out}")
