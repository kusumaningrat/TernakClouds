package pkg

import "github.com/gin-gonic/gin"

func RespondOK(c *gin.Context, status int, data any) {
	c.JSON(status, gin.H{"data": data})
}

func RespondMessage(c *gin.Context, status int, message string) {
	c.JSON(status, gin.H{"message": message})
}
