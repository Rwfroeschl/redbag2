import * as React from 'react';
import { useState } from 'react';
import * as XLSX from 'xlsx';
import {
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Button,
    Alert,
    Paper,
} from '@mui/material';

import { gql, useMutation, useQuery } from '@apollo/client';
import { createSponsor } from '../graphql/mutations';
import { listSponsors } from '../graphql/queries';

export default function ImportSponsors({ open, handleClose }){
    const [failures, setFailures] = useState([]);
    const [excelFile, setExcelFile] = useState(null);
    const [typeError, setTypeError] = useState(null);
    const [excelData, setExcelData] = useState(null);
    const [previewData, setPreviewData] = useState(null);
    
    let input;
    const [addSponsorMutation, { data, loading, error }] = useMutation(gql(createSponsor));
    if(loading) {
        return <div>Loading...</div>
    }

    console.log("ImportSponsor.js, excelFile=", excelFile);

    const handleFileSubmit=(e)=>{
        e.preventDefault();
        if(excelFile!==null){
            const workbook = XLSX.read(excelFile,{type: 'buffer'});
            const worksheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[worksheetName];
            const data = XLSX.utils.sheet_to_json(worksheet);
            setPreviewData(data.slice(0,10));
            setExcelData(data);
        }
    };

    const FindSponsorByPhone = (phoneNum) => {        
        var result = '';
        try{            
            const [loading, error, data] = useQuery(gql(getSponsorByPhone, {variables: {phoneNum}})); 
            if(!loading || data ) {
                console.log("GetSponsorByPhone, data is ", data);
                if (error) {
                    result = "FindSponsorByPhone failed with error: " + error;
                }else{
                    result = data;
                }
            }
        }catch(catchError) {
            result = "FindSponsorByPhone failed with error: " + catchError;
        };

        return result;
    };

    const CreateSponsorFromSpreadsheetRow = async (rowData) => {        
        var result = '';
        try{
            const response = await addSponsorMutation({
                variables: 
                    { input: { 
                        FirstName: rowData(0), 
                        LastName: '', 
                        Email: rowData(2), 
                        Phone: rowData(3), 
                        Institution: rowData(1), 
                        Address: (rowData(4) + " " + rowData(5) + ", " + rowData(6) + " " + rowData(7)), 
                        YearsActive: rowData(8), 
                        } 
                    }, 
                    refetchQueries: [{ query: gql(listSponsors) }]
            });
        } catch(error) {
            result = "addSponsor failed with error: " + error;
        }

        return result;
    };

    const handleDialogClose=() => {
        setFailures(null);
        setExcelFile(null);
        setExcelData(null);
        setPreviewData(null);
        setTypeError(null);
        handleClose();
    }

    const handleImport=() => {
        var result = '';
        var sponsorName = '';
        var numAdd = 0;
        var numAddFail = 0;
        var numUpdate = 0;
        var numUpdateFail = 0;
        //Our source data is in the variable: excelData
        
        //Map through all rows
        excelData.map((row, index) => {
            //row 0 contains headers, so ignor it
            if (index!==0) {
                result = '';
                sponsorName = row(0);

                //fetch Sponsor with that name.  Need to fetch a sponsor by Name
                sponsorFound = FindSponsorByPhone(row(3));
                //If Sponsor found
                //  update sponsor
                //Else
                    //Add Sponsor
                    result = CreateSponsorFromSpreadsheetRow(row);
                    if (result.length > 0 ) {
                        result = sponsorName + " at row " + index + " failed to load: " + result;
                        numAddFail += 1;
                        setFailures(...failures, result);
                    }else{
                        numAdd += 1;
                    };
                //  End if
            }
        });
    };

    // onchange event
    const handleFile=(e)=>{
        setTypeError(null);
        let fileTypes = ['application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','text/csv'];
        let selectedFile = e.target.files[0];
        if(selectedFile){
            if(fileTypes.includes(selectedFile.type)){
                setTypeError(null);
                setExcelFile(null);
                setPreviewData(null);
                setExcelData(null);
                let reader = new FileReader();
                reader.readAsArrayBuffer(selectedFile);
                reader.onload=(e)=>{
                    setExcelFile(e.target.result);
                };
                console.log("handleFile, about to call PreviewFile() excelFile=", excelFile);                
            }else{
                setTypeError('File must be an Excel file type (*.xlsx)');
                setExcelFile(null);
                setPreviewData(null);
                setExcelData(null);
            }
        }
    };

    return(
        <React.Fragment>
            <Dialog open={open} onClose={handleClose}>
            <DialogTitle>Please Select an Excel File of Sponsor Information</DialogTitle>
            <DialogContent>
                <div>
                    <form onSubmit={handleFileSubmit}>
                        <input type="file" required onChange={handleFile}/>
                        <Button type="submit" variant="text">Preview File</Button>                        
                        {typeError&&(
                            <Alert severity="error">{typeError}</Alert>
                        )}
                    </form>

                    {/* view data */}                    
                    <div>
                        {previewData?(
                            <div className="table-responsive">
                                <h3>File Preview (first 10 rows)</h3>
                                <table className="table">
                                    <thead>
                                        <tr>
                                            {Object.keys(previewData[0]).map((key)=>(
                                            <th key={key}>{key}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {previewData.map((individualExcelData, index)=>(
                                            <tr key={index}>
                                            {Object.keys(individualExcelData).map((key)=>(
                                                <td key={key}>{individualExcelData[key]}</td>
                                            ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ):(
                            <div></div>
                        )}
                    </div>
                </div>
            </DialogContent>
            <DialogActions>
                <Button variant="outlined" onClick={handleDialogClose}>Cancel</Button>
                <Button variant="contained" onClick={handleImport}>Import</Button>
            </DialogActions>
            </Dialog>
        </React.Fragment>
    )
};