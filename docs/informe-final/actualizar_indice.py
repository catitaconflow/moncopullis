# Abre el .docx en LibreOffice (headless), actualiza el índice y los campos, y guarda .docx y .pdf.
import subprocess, time, sys, pathlib, uno
from com.sun.star.beans import PropertyValue

src = pathlib.Path(sys.argv[1]).resolve()
port = 2002
proc = subprocess.Popen(["soffice", "--headless", "--invisible", "--norestore",
                         f"--accept=socket,host=127.0.0.1,port={port};urp;"])
ctx = None
local = uno.getComponentContext()
resolver = local.ServiceManager.createInstanceWithContext("com.sun.star.bridge.UnoUrlResolver", local)
for _ in range(60):
    try:
        ctx = resolver.resolve(f"uno:socket,host=127.0.0.1,port={port};urp;StarOffice.ComponentContext")
        break
    except Exception:
        time.sleep(1)
smgr = ctx.ServiceManager
desktop = smgr.createInstanceWithContext("com.sun.star.frame.Desktop", ctx)


def prop(n, v):
    p = PropertyValue(); p.Name = n; p.Value = v; return p


doc = desktop.loadComponentFromURL(src.as_uri(), "_blank", 0, (prop("Hidden", True),))
idx = doc.getDocumentIndexes()
for i in range(idx.getCount()):
    idx.getByIndex(i).update()
doc.getTextFields().refresh()
# segunda pasada: el índice puede mover páginas
for i in range(idx.getCount()):
    idx.getByIndex(i).update()
doc.storeToURL(src.as_uri(), (prop("FilterName", "MS Word 2007 XML"),))
doc.storeToURL(src.with_suffix(".pdf").as_uri(), (prop("FilterName", "writer_pdf_Export"),))
print("índices actualizados:", idx.getCount())
doc.close(True)
try:
    desktop.terminate()
except Exception:
    pass
proc.wait(timeout=30)
