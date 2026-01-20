const users = [
    {
        id: 1,
        username: "admin",
        password: "admin123",
        name: "System Administrator",
        role: "admin",
        email: "admin@leelidc.com",
        rcNo: "ADM001",
        leaveBalance: {
            sick: 10,
            frl: 5,
            annual: 20
        }
    },
    {
        id: 2,
        username: "john",
        password: "john123",
        name: "John Smith",
        role: "user",
        email: "john@leelidc.com",
        rcNo: "EMP001",
        leaveBalance: {
            sick: 7,
            frl: 3,
            annual: 15
        }
    },
    {
        id: 3,
        username: "sarah",
        password: "sarah123",
        name: "Sarah Johnson",
        role: "user",
        email: "sarah@leelidc.com",
        rcNo: "EMP002",
        leaveBalance: {
            sick: 5,
            frl: 2,
            annual: 12
        }
    },
    {
        id: 4,
        username: "mike",
        password: "mike123",
        name: "Mike Williams",
        role: "user",
        email: "mike@leelidc.com",
        rcNo: "EMP003",
        leaveBalance: {
            sick: 8,
            frl: 4,
            annual: 18
        }
    }
];

export default users;
