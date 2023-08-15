// packages
const electron = require('electron');
const Store = require('electron-store');

// extracting from packages
const { app, BrowserWindow, Menu, ipcMain } = electron;
const store = new Store();

// windows
let mainWindow;
let addBinWindow;
let viewBinWindow;
let addNoteWindow;
let editNoteWindow;
let drawingResultWindow;
let deleteBinWindow;
let errorWindow;

// data
let currentBin;
let currentNoteIndex;
let winningNoteIndex;
let bins = store.get('bins') || [];

// settings
const standardBrowserSettings = {
    webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
    },
    icon: 'assets/icon.png'
};


app.on('ready', async () => {
    // setup main window
    mainWindow = new BrowserWindow({
        minWidth: 420,
        minHeight: 220,
        ...standardBrowserSettings
    });
    mainWindow.loadFile('src/mainWindow.html')
        .then(() => {
            mainWindow.webContents.send('bins:update', bins);
        });
    mainWindow.setMenu(null);

    // quit app when main window closed
    mainWindow.on('closed', () => {
        app.quit();
    });
});


//
// Context Menu
//

ipcMain.on('main:contextMenu', (e, binIndex) => {
    currentBin = bins[binIndex];
    const contextMenuTemplate = [
        {
            label: 'Draw note',
            click: () => { drawNote(currentBin); }
        },
        {
            label: 'Add note',
            click: () => { addNote(currentBin); }
        },
        {
            label: 'Edit',
            click: () => { viewBin(currentBin); }
        },
        {
            label: 'Delete',
            click: () => { deleteBin(currentBin); }
        }
    ];
    const contextMenu = Menu.buildFromTemplate(contextMenuTemplate);
    contextMenu.popup();
});

ipcMain.on('bin:contextMenu', (e, noteIndex) => {
    const contextMenuTemplate = [
        {
            label: 'Edit',
            click: () => { editNote(currentBin, noteIndex); }
        },
        {
            label: 'Delete',
            click: () => { deleteNote(currentBin, noteIndex); }
        }
    ];
    const contextMenu = Menu.buildFromTemplate(contextMenuTemplate);
    contextMenu.popup();
});



//
// listen for bin actions
//

// show add bin window
ipcMain.on('bin:showAdd', () => {
    addBinWindow = new BrowserWindow({
        parent: mainWindow,
        modal: true,
        width: 300,
        height: 200,
        minWidth: 250,
        minHeight: 150,
        ...standardBrowserSettings
    });
    addBinWindow.loadFile('src/addBinWindow.html');
    addBinWindow.setMenu(null);

    // garbage collection
    addBinWindow.on('closed', () => {
        addBinWindow = null;
    })
});

// add bin
ipcMain.on('bin:add', (e, binName) => {
    // update bins data
    bins.push({ name: binName, notes: [] })
    store.set('bins', bins);
    mainWindow.webContents.send('bins:update', bins);

    // close add bin window
    addBinWindow.close();
});

// view bin window
ipcMain.on('bin:view', (e, binIndex) => {
    currentBin = bins[binIndex];
    viewBin(currentBin);
});

function viewBin(bin) {
    if (viewBinWindow) {
        // update data if window already exists
        viewBinWindow.webContents.send('bin:update', bin);
    } else {
        // create new window
        viewBinWindow = new BrowserWindow({
            parent: mainWindow,
            modal: true,
            width: 500,
            height: 550,
            minWidth: 340,
            minHeight: 240,
            ...standardBrowserSettings
        });

        // load window and update data 
        viewBinWindow.loadFile('src/viewBinWindow.html')
            .then(() => {
                viewBinWindow.webContents.send('bin:update', bin);
            });
        viewBinWindow.setMenu(null);
    
        // garbage collection
        viewBinWindow.on('closed', () => {
            viewBinWindow = null;
            if (addNoteWindow)
                addNoteWindow.close();
            if (editNoteWindow)
                editNoteWindow.close();
            if (drawingResultWindow)
                drawingResultWindow.close();
    
            mainWindow.webContents.send('bins:update', bins);
        });
    }
}


// refresh bins
ipcMain.on('bin:refresh', () => {
    mainWindow.webContents.send('bins:update', bins);
});

// change bin name
ipcMain.on('bin:nameChange', (e, newName) => {
    currentBin.name = newName;
});


//
// Listen for bin delete actions
//
ipcMain.on('bin:showDelete', () => {
    deleteBin(currentBin);
});

function deleteBin(bin) {
    // create new window
    deleteBinWindow = new BrowserWindow({
        parent: (viewBinWindow)? viewBinWindow : mainWindow,
        modal: true,
        width: 350,
        height: 250,
        minWidth: 350,
        minHeight: 250,
        ...standardBrowserSettings
    });

    // update window contents
    deleteBinWindow.loadFile('src/deleteBinWindow.html')
        .then(() => {
            deleteBinWindow.webContents.send('bindel:info', bin.name);
        });
    deleteBinWindow.setMenu(null);

    // garbage collection
    deleteBinWindow.on('closed', () => {
        deleteBinWindow = null;
    });
}

ipcMain.on('bindel:yes', () => {
    if (viewBinWindow)
        viewBinWindow.close();
    if (deleteBinWindow)
        deleteBinWindow.close();

    // remove bin
    const binIndex = bins.findIndex(b => b === currentBin);
    bins.splice(binIndex, 1);

    // update main window
    mainWindow.webContents.send('bins:update', bins);
    mainWindow.focus();

    // update storage
    store.set('bins', bins);
});

ipcMain.on('bindel:no', () => {
    if (deleteBinWindow)
        deleteBinWindow.close();
});


//
// Listen for note actions
//

// show add note window
ipcMain.on('note:showAdd', () => {
    addNote();
});

function addNote(bin) {
    addNoteWindow = new BrowserWindow({
        parent: (viewBinWindow)? viewBinWindow : mainWindow,
        modal: true,
        width: 300,
        height: 250,
        minWidth: 300,
        minHeight: 250,
        ...standardBrowserSettings
    });
    addNoteWindow.loadFile('src/addNoteWindow.html');
    addNoteWindow.setMenu(null);

    // garbage collection
    addNoteWindow.on('closed', () => {
        addNoteWindow = null;
    });
}


// add note
ipcMain.on('note:add', (e, note) => {
    // close window
    if (addNoteWindow)
        addNoteWindow.close();

    // update storage
    currentBin.notes.push(note);
    store.set('bins', bins);

    // reflect changes visually
    if (viewBinWindow) {
        viewBinWindow.webContents.send('bin:update', currentBin);
        viewBinWindow.focus(0);
    }
});

// refresh notes
ipcMain.on('note:refresh', () => {
    viewBinWindow.webContents.send('bin:update', currentBin);
});

// show edit note window
ipcMain.on('note:showEdit', (e, noteIndex) => {
    editNote(currentBin, noteIndex);
});

function editNote(bin, noteIndex) {
    editNoteWindow = new BrowserWindow({
        parent: viewBinWindow,
        modal: true,
        width: 300,
        height: 250,
        minWidth: 300,
        minHeight: 250,
        ...standardBrowserSettings
    });
    editNoteWindow.loadFile('src/editNoteWindow.html')
        .then(() => {
            // update window with note info
            currentNoteIndex = noteIndex;
            const note = bin.notes[currentNoteIndex];
            editNoteWindow.webContents.send('note:info', note);
        });
    editNoteWindow.setMenu(null);

    // garbage collection
    editNoteWindow.on('closed', () => {
        editNoteWindow = null;
    });
}


// update note
ipcMain.on('note:update', (e, newNote) => {
    currentBin.notes[currentNoteIndex] = newNote;
    editNoteWindow.close();

    // update bin window
    viewBinWindow.webContents.send('bin:update', currentBin);
    viewBinWindow.focus();

    // update storage
    store.set('bins', bins);
});

// close edit note window
ipcMain.on('note:closeEdit', () => {
    editNoteWindow.close();
});

// delete note
ipcMain.on('note:delete', () => {
    deleteNote(currentBin, currentNoteIndex);
});

function deleteNote(bin, noteIndex) {
    // update data
    bin.notes.splice(noteIndex, 1);
    store.set('bins', bins);

    // close edit note window
    if (editNoteWindow)
        editNoteWindow.close();

    // update windows
    if (viewBinWindow) {
        viewBinWindow.webContents.send('bin:update', bin);
        viewBinWindow.focus();
    }
}


// draw random note
ipcMain.on('note:draw', () => {
    drawNote(currentBin);
});

function drawNote(bin) {
    // error if no notes
    if (bin.notes.length == 0) {
        const currentWindow = (viewBinWindow)? viewBinWindow : mainWindow;
        showError(currentWindow, "This bin doesn't have any notes!");
        return;
    }

    if (drawingResultWindow) {
        // update winner if window exists
        winningNoteIndex = Math.floor( Math.random()*bin.notes.length );
        const winningNote = bin.notes[winningNoteIndex];
        drawingResultWindow.webContents.send('note:drawResult', winningNote);
    } else {
        // create new window
        drawingResultWindow = new BrowserWindow({
            parent: (viewBinWindow)? viewBinWindow : mainWindow,
            modal: true,
            width: 300,
            height: 250,
            minWidth: 300,
            minHeight: 200,
            ...standardBrowserSettings
        });

        // load content and update data
        drawingResultWindow.loadFile('src/drawNoteWindow.html')
            .then(() => {
                winningNoteIndex = Math.floor( Math.random()*bin.notes.length );
                const winningNote = bin.notes[winningNoteIndex];
                drawingResultWindow.webContents.send('note:drawResult', winningNote);
            });

        // disable menu bar
        drawingResultWindow.setMenu(null);
    
        // garbage collection
        drawingResultWindow.on('closed', () => {
            drawingResultWindow = null;
        });
    }
}


// delete winning note
ipcMain.on('note:deleteWinner', () => {
    drawingResultWindow.close();
    
    // update bin data
    currentBin.notes.splice(winningNoteIndex, 1);
    store.set('bins', bins);
    
    // update view bin window
    if (viewBinWindow) {
        viewBinWindow.webContents.send('bin:update', currentBin);
        viewBinWindow.focus();
    } else {
        mainWindow.focus();
    }
});

// draw another note
ipcMain.on('note:drawAgain', () => {
    // get new winner
    winningNoteIndex = Math.floor( Math.random()*currentBin.notes.length );
    const winningNote = currentBin.notes[winningNoteIndex];

    // update window
    drawingResultWindow.webContents.send('note:drawResult', winningNote);
    drawingResultWindow.focus();
});



//
// Handle errors
//

function showError(parentWindow, message) {
    if (errorWindow) {
        errorWindow.webContents.send('error:loadmsg', message);
    } else {
        // create new window
        errorWindow = new BrowserWindow({
            parent: parentWindow,
            modal: true,
            width: 350,
            height: 200,
            minWidth: 350,
            minHeight: 200,
            ...standardBrowserSettings
        });

        // load window content
        errorWindow.loadFile('src/errorWindow.html')
            .then(() => {
                errorWindow.webContents.send('error:loadmsg', message);
            });
        errorWindow.setMenu(null);

        // garbage collection
        errorWindow.on('closed', () => {
            errorWindow = null;
        });
    }
}

ipcMain.on('error:close', () => {
    errorWindow.close();
});
