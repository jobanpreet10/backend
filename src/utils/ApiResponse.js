class ApiResponse {
    constructor (stauscode ,data ,message = "Sucess"){
        this.stauscode =stauscode,
        this.data = data,
        this.message = message,
        this.sucess = sucessCode < 400
    }
}